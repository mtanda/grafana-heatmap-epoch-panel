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
      var currentSpan = null;

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
        if (!data) {
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

      function getHeatmapData(datapoints) {
        var windowInterval = Math.floor((ctrl.range.to - ctrl.range.from) / panel.heatmapOptions.windowSize);
        return _.chain(datapoints)
        .reject(function(dp) {
          return dp[0] === null;
        })
        .groupBy(function(dp) {
          return Math.ceil((dp[1] - ctrl.range.from) / windowInterval);
        })
        .filter(function(value, timeKey) {
          return timeKey < panel.heatmapOptions.windowSize;
        })
        .map(function(values, timeKey) {
          return {
            time: Math.floor((timeKey * windowInterval + ctrl.range.from) / 1000),
            histogram: _.countBy(values, function(value) {
              return value[0];
            })
          };
        })
        .sortBy(function(dp) {
          return dp.time;
        }).value();
      }

      function callPlot(incrementRenderCounter, data) {
        try {
          epoch.setData(data);

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

          epoch.redraw();
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

        _.each(data, function (series) {
          series.epochLabel = series.label.replace(/[ !"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~]/g, ' ');
        });

        if (panel.datasource !== currentDatasource) {
          panel.heatmapOptions.startTime = Math.floor(ctrl.range.from.valueOf() / 1000);
          firstDraw = true;
        }
        currentDatasource = panel.datasource;

        if (firstDraw) {
          delta = true;
          var seriesData = _.map(data, function (series, i) {
            delta = delta && series.color; // use color as delta temporaly, if all series is delta, enable realtime chart

            // if hidden remove points
            if (ctrl.hiddenSeries[series.alias]) {
              return {};
            }

            return {
              label: series.epochLabel,
              values: getHeatmapData(series.datapoints)
            };
          });

          panel.heatmapOptions.data = seriesData;
          if (!epoch) {
            epoch = elem.epoch(panel.heatmapOptions);
            scope.$watch('ctrl.panel.heatmapOptions.windowSize', function(newVal, oldVal) {
              epoch.option('windowSize', newVal);
              epoch.option('historySize', newVal * 3);
              epoch.redraw();
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
              epoch.redraw();
            });
          }

          var width = elem.parent().width();
          var height = elem.parent().height();
          if (width !== currentSize.width) {
            epoch.option('width', width);
          }
          if (height !== currentSize.height) {
            epoch.option('height', height - getLegendHeight(height));
          }
          currentSize.width = width;
          currentSize.height = height;

          if (panel.span !== currentSpan) {
            epoch.option('ticks.time', Math.ceil(5 * 12 / panel.span));
            epoch.ticksChanged();
          }
          currentSpan = panel.span;

          if (shouldDelayDraw(panel)) {
            // temp fix for legends on the side, need to render twice to get dimensions right
            callPlot(false, seriesData);
            setTimeout(function() { callPlot(true, seriesData); }, 50);
            legendSideLastValue = panel.legend.rightSide;
          } else {
            callPlot(true, seriesData);
          }

          if (delta) {
            firstDraw = false;

            labelToModelIndexMap = {};
            _.each(data, function (series, i) {
              labelToModelIndexMap[series.epochLabel] = i;
            });
          }
        } else if (delta) {
          var indexedData = [];
          var dataLength = 0;
          _.each(data, function (series) {
            if (_.isUndefined(labelToModelIndexMap[series.epochLabel])) {
              return;
            }

            var values = getHeatmapData(series.datapoints);
            indexedData[labelToModelIndexMap[series.epochLabel]] = values;

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
                    0: 0
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
            return "HH:mm:ss";
          }
          if (secPerTick <= 7200 || range <= oneDay) {
            return "HH:mm";
          }
          if (secPerTick <= 80000) {
            return "M/D HH:mm";
          }
          if (secPerTick <= 2419200 || range <= oneYear) {
            return "M/D";
          }
          return "YYYY-M";
        }

        return "HH:mm";
      }

      function shouldDelayDraw(panel) {
        if (panel.legend.rightSide) {
          return true;
        }
        if (legendSideLastValue !== null && panel.legend.rightSide !== legendSideLastValue) {
          return true;
        }
      }

      elem.bind("plotselected", function (event, ranges) {
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
