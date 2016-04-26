import angular from 'angular';
import $ from 'jquery';
import moment from 'moment';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import './bower_components/d3/d3.min.js';
import './bower_components/epoch/dist/js/epoch.js';

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

      // Function for rendering panel
      function render_panel() {
        if (shouldAbortRender()) {
          return;
        }

        var heatmapOptions = {
          type: 'time.heatmap',
          axes: ['left', 'bottom', 'right'],
          opacity: function(value, max) {
            return Math.pow((value/max), 0.7);
          }
        };
        if (panel.windowSize) {
          heatmapOptions.windowSize = panel.windowSize;
        }
        if (panel.buckets) {
          heatmapOptions.buckets = panel.buckets;
        }
        if (panel.bucketRangeLower && panel.bucketRangeUpper) {
          heatmapOptions.bucketRange = [panel.bucketRangeLower, panel.bucketRangeUpper];
        }

        var delta = true;
        for (var i = 0; i < data.length; i++) {
          var series = data[i];
          delta = delta && series.color; // use color as delta temporaly, if all series is delta, enable realtime chart

          var values = _.chain(series.datapoints)
          .reject(function(dp) {
            return dp[0] === null;
          })
          .sortBy(function(dp) {
            return dp[1];
          })
          .map(function(dp) {
            return {
              time: dp[1],
              value: dp[0]
            }
          })
          .groupBy(function(dp) {
            return dp.time;
          })
          .map(function(values, time) {
            return {
              time: Math.floor(time / 1000),
              histogram: _.countBy(values, function(value) {
                return value.value;
              })
            };
          }).value();
          series.data = {
            label: series.label,
            values: values
          }

          // if hidden remove points
          if (ctrl.hiddenSeries[series.alias]) {
            series.data = [];
          }
        }

        sortedSeries = _.chain(data)
        .map(function(series) {
          return series.data;
        })
        .sortBy(function(series) {
          return series.label;
        })
        .value();
        heatmapOptions.data = sortedSeries;

        function callPlot(incrementRenderCounter) {
          try {
            epoch = elem.epoch(heatmapOptions);
          } catch (e) {
            console.log('epoch error', e);
          }

          if (incrementRenderCounter) {
            ctrl.renderingCompleted();
          }
        }

        if (epoch && delta) {
          epoch.push(sortedSeries);
          ctrl.renderingCompleted();
        }
        else if (shouldDelayDraw(panel)) {
          // temp fix for legends on the side, need to render twice to get dimensions right
          callPlot(false);
          setTimeout(function() { callPlot(true); }, 50);
          legendSideLastValue = panel.legend.rightSide;
        }
        else {
          callPlot(true);
        }
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
