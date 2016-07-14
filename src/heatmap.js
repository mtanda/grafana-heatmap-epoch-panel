import angular from 'angular';
import $ from 'jquery';
import moment from 'moment';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import './bower_components/d3/d3.min.js';
import './bower_components/epoch/dist/js/epoch.min.js';

angular.module('grafana.directives').directive('grafanaHeatmapEpoch', function($rootScope, timeSrv) {
  return {
    restrict: 'A',
    template: '<div> </div>',
    link: function(scope, elem) {
      var ctrl = scope.ctrl;
      var dashboard = ctrl.dashboard;
      var panel = ctrl.panel;
      var data;
      var sortedSeries;
      var legendSideLastValue = null;
      var rootScope = scope.$root;
      var epoch = null;
      var firstDraw = true;
      var delta = true;
      var labelToModelIndexMap = {};
      var currentDatasource = '';
      var currentTimeRange = [0, 0];
      var currentSize = { width: null, height: null };

      // Receive render events
      ctrl.events.on('render', function(renderData) {
        data = renderData || data;
        if (!data) {
          ctrl.refresh();
          return;
        }
        render_panel();
      });

      function getLegendHeight(panelHeight) {
        if (!panel.legend.show || panel.legend.rightSide) {
          return 2;
        }

        if (panel.legend.alignAsTable) {
          var legendSeries = _.filter(data, function(series) {
            return series.hideFromLegend(panel.legend) === false;
          });
          var total = 23 + (22 * legendSeries.length);
          return Math.min(total, Math.floor(panelHeight/2));
        } else {
          return 26;
        }
      }

      function setElementHeight() {
        try {
          var height = ctrl.height - getLegendHeight(ctrl.height);
          elem.css('height', height + 'px');

          return true;
        } catch(e) { // IE throws errors sometimes
          console.log(e);
          return false;
        }
      }

      function shouldAbortRender() {
        if (!data || _.isEmpty(data)) {
          return true;
        }

        if (!setElementHeight()) { return true; }

        if (elem.width() === 0) {
          return true;
        }
      }

      function processOffsetHook(plot, gridMargin) {
        var left = panel.yaxes[0];
        var right = panel.yaxes[1];
        if (left.show && left.label) { gridMargin.left = 20; }
        if (right.show && right.label) { gridMargin.right = 20; }
      }

      function getEpoch() {
        if (epoch) {
          return epoch;
        }

        epoch = elem.epoch(panel.heatmapOptions);
        scope.$watch('ctrl.panel.heatmapOptions.windowSize', function(newVal, oldVal) {
          epoch.option('windowSize', newVal);
          epoch.option('historySize', newVal * 3);
          redraw();
        });
        scope.$watch('ctrl.panel.heatmapOptions.buckets', function(newVal, oldVal) {
          epoch.option('buckets', newVal);
        });
        scope.$watch('ctrl.panel.heatmapOptions.bucketRange[0]', function(newVal, oldVal) {
          epoch.option('bucketRange', panel.heatmapOptions.bucketRange);
        });
        scope.$watch('ctrl.panel.heatmapOptions.bucketRange[1]', function(newVal, oldVal) {
          epoch.option('bucketRange', panel.heatmapOptions.bucketRange);
        });
        scope.$watch('ctrl.panel.heatmapOptions.startTime', function(newVal, oldVal) {
          epoch.option('startTime', newVal);
          redraw();
        });

        return epoch;
      }

      function resize(width, height) {
        if (width !== currentSize.width) {
          epoch.option('width', width);
          var ticksTime = Math.floor(panel.heatmapOptions.windowSize * 30 * 2 / width);
          epoch.option('ticks.time', ticksTime);
          epoch.ticksChanged();
        }
        if (height !== currentSize.height) {
          epoch.option('height', height);
        }
        currentSize.width = width;
        currentSize.height = height;
      }

      function getHeatmapData(datapoints, delta) {
        var windowInterval = Math.floor((ctrl.range.to - ctrl.range.from) / panel.heatmapOptions.windowSize);
        var groupedData = _.chain(datapoints)
        .reject(function(dp) {
          return dp[0] === null;
        })
        .groupBy(function(dp) {
          return Math.floor((dp[1] - ctrl.range.from) / windowInterval) + 1;
        }).value();

        var data = [];
        var n;
        var keys = _.keys(groupedData);
        var min = delta ? _.min(keys) : 1;
        var max = delta ? _.max(keys) : panel.heatmapOptions.windowSize + 1;
        for (n = min; n <= max; n++) {
          var values = groupedData[n] || [];

          data.push({
            time: Math.floor((n * windowInterval + ctrl.range.from) / 1000),
            histogram: _.countBy(values, function(value) {
              return value[0];
            })
          });
        }

        if (data.length > panel.heatmapOptions.windowSize) {
          data[panel.heatmapOptions.windowSize].histogram = {};
        }

        return data;
      }

      var inRedraw = false;
      function redraw() {
        if (inRedraw) {
          return;
        }

        inRedraw = true;
        var epoch = getEpoch();
        setTimeout(function() {
          epoch.redraw();
          inRedraw = false;
        }, 0);
      }

      function callPlot(incrementRenderCounter, data) {
        try {
          epoch.setData(data);

          _.each(data, function(d) {
            epoch.showLayer(d.label);
            if (ctrl.hiddenSeries[d.alias]) {
              epoch.hideLayer(d.label);
            }
          });

          if (ctrl.range.from !== currentTimeRange[0] || ctrl.range.to !== currentTimeRange[1]) {
            var ticks = Math.ceil(panel.heatmapOptions.windowSize / panel.heatmapOptions.ticks.time);
            var min = _.isUndefined(ctrl.range.from) ? null : ctrl.range.from.valueOf();
            var max = _.isUndefined(ctrl.range.to) ? null : ctrl.range.to.valueOf();
            epoch.option('tickFormats.bottom', function (d) {
              var timeFormat = time_format(ticks, min, max);
              return moment.unix(d).format(timeFormat);
            });
            epoch.ticksChanged();
          }
          currentTimeRange = [ctrl.range.from, ctrl.range.to];

          redraw();
        } catch (e) {
          console.log('epoch error', e);
        }

        if (incrementRenderCounter) {
          ctrl.renderingCompleted();
        }
      }

      // Function for rendering panel
      function render_panel() {
        if (shouldAbortRender()) {
          return;
        }

        // reset startTime if datasource is changed
        if (panel.datasource !== currentDatasource) {
          panel.heatmapOptions.startTime = Math.floor(ctrl.range.from.valueOf() / 1000);
          firstDraw = true;
        }
        currentDatasource = panel.datasource;

        var epoch = getEpoch();

        // check panel size change
        var width = elem.parent().width();
        var height = elem.parent().height();
        resize(width, height);

        if (firstDraw) {
          delta = true;
          var seriesData = _.map(data, function (series) {
            delta = delta && series.unit; // use unit as delta temporaly, if all series is delta, enable realtime chart
            var epochLabel = ctrl.getEpochLabel(series.label);

            return {
              alias: series.label,
              label: epochLabel,
              values: getHeatmapData(series.datapoints, false)
            };
          });

          if (shouldDelayDraw(panel)) {
            // fix right legend
            if (panel.legend.rightSide) {
              width -= ctrl.legendWidth;
            }
            resize(width, height);

            callPlot(true, seriesData);
            legendSideLastValue = panel.legend.rightSide;
          } else {
            callPlot(true, seriesData);
          }

          // create model index for realtime graph
          if (delta) {
            firstDraw = false;

            labelToModelIndexMap = {};
            _.each(data, function (series, i) {
              labelToModelIndexMap[series.label] = i;
            });
          }
        } else if (delta) { // realtime graph
          var indexedData = [];
          var dataLength = 0;
          _.each(data, function (series) {
            if (_.isUndefined(labelToModelIndexMap[series.label])) {
              return;
            }

            var values = getHeatmapData(series.datapoints, true);
            indexedData[labelToModelIndexMap[series.label]] = values;

            if (dataLength < values.length) {
              dataLength = values.length;
            }
          });

          if (!_.isEmpty(indexedData)) {
            var now = new Date() / 1000;
            for (var n = 0; n < dataLength; n++) {
              var pushData = indexedData.map(function (d) {
                return d[n] || {
                  time: now,
                  histogram: {
                  }
                };
              });
              epoch.push(pushData);
            }
          }
          ctrl.renderingCompleted();
        }
      }

      function time_format(ticks, min, max) {
        if (min && max && ticks) {
          var range = max - min;
          var secPerTick = (range/ticks) / 1000;
          var oneDay = 86400000;
          var oneYear = 31536000000;

          if (secPerTick <= 45) {
            return 'HH:mm:ss';
          }
          if (secPerTick <= 7200 || range <= oneDay) {
            return 'HH:mm';
          }
          if (secPerTick <= 80000) {
            return 'M/D HH:mm';
          }
          if (secPerTick <= 2419200 || range <= oneYear) {
            return 'M/D';
          }
          return 'YYYY-M';
        }

        return 'HH:mm';
      }

      function shouldDelayDraw(panel) {
        if (panel.legend.rightSide) {
          return true;
        }
        if (legendSideLastValue !== null && panel.legend.rightSide !== legendSideLastValue) {
          return true;
        }
      }

      elem.bind('plotselected', function (event, ranges) {
        scope.$apply(function() {
          timeSrv.setTime({
            from  : moment.utc(ranges.xaxis.from),
            to    : moment.utc(ranges.xaxis.to),
          });
        });
      });
    }
  };
});
