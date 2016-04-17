'use strict';

System.register(['angular', 'jquery', 'moment', 'lodash', 'app/core/utils/kbn', './bower_components/d3/d3.min.js', './bower_components/epoch/dist/js/epoch.min.js'], function (_export, _context) {
  var angular, $, moment, _, kbn;

  return {
    setters: [function (_angular) {
      angular = _angular.default;
    }, function (_jquery) {
      $ = _jquery.default;
    }, function (_moment) {
      moment = _moment.default;
    }, function (_lodash) {
      _ = _lodash.default;
    }, function (_appCoreUtilsKbn) {
      kbn = _appCoreUtilsKbn.default;
    }, function (_bower_componentsD3D3MinJs) {}, function (_bower_componentsEpochDistJsEpochMinJs) {}],
    execute: function () {

      angular.module('grafana.directives').directive('grafanaHeatmapEpoch', function ($rootScope, timeSrv) {
        return {
          restrict: 'A',
          template: '<div> </div>',
          link: function link(scope, elem) {
            var ctrl = scope.ctrl;
            var dashboard = ctrl.dashboard;
            var panel = ctrl.panel;
            var data;
            var sortedSeries;
            var legendSideLastValue = null;
            var rootScope = scope.$root;

            // Receive render events
            ctrl.events.on('render', function (renderData) {
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
                var legendSeries = _.filter(data, function (series) {
                  return series.hideFromLegend(panel.legend) === false;
                });
                var total = 23 + 22 * legendSeries.length;
                return Math.min(total, Math.floor(panelHeight / 2));
              } else {
                return 26;
              }
            }

            function setElementHeight() {
              try {
                var height = ctrl.height - getLegendHeight(ctrl.height);
                elem.css('height', height + 'px');

                return true;
              } catch (e) {
                // IE throws errors sometimes
                console.log(e);
                return false;
              }
            }

            function shouldAbortRender() {
              if (!data) {
                return true;
              }

              if (!setElementHeight()) {
                return true;
              }

              if (_.isString(data)) {
                render_panel_as_graphite_png(data);
                return true;
              }

              if (elem.width() === 0) {
                return true;
              }
            }

            function drawHook(plot) {
              // Update legend values
              var yaxis = plot.getYAxes();
              for (var i = 0; i < data.length; i++) {
                var series = data[i];
                var axis = yaxis[series.yaxis - 1];
                var formater = kbn.valueFormats[panel.yaxes[series.yaxis - 1].format];

                // decimal override
                if (_.isNumber(panel.decimals)) {
                  series.updateLegendValues(formater, panel.decimals, null);
                } else {
                  // auto decimals
                  // legend and tooltip gets one more decimal precision
                  // than graph legend ticks
                  var tickDecimals = (axis.tickDecimals || -1) + 1;
                  series.updateLegendValues(formater, tickDecimals, axis.scaledDecimals + 2);
                }

                if (!rootScope.$$phase) {
                  scope.$digest();
                }
              }

              // add left axis labels
              if (panel.yaxes[0].label) {
                var yaxisLabel = $("<div class='axisLabel left-yaxis-label'></div>").text(panel.yaxes[0].label).appendTo(elem);

                yaxisLabel.css("margin-top", yaxisLabel.width() / 2);
              }

              // add right axis labels
              if (panel.yaxes[1].label) {
                var rightLabel = $("<div class='axisLabel right-yaxis-label'></div>").text(panel.yaxes[1].label).appendTo(elem);

                rightLabel.css("margin-top", rightLabel.width() / 2);
              }
            }

            function processOffsetHook(plot, gridMargin) {
              var left = panel.yaxes[0];
              var right = panel.yaxes[1];
              if (left.show && left.label) {
                gridMargin.left = 20;
              }
              if (right.show && right.label) {
                gridMargin.right = 20;
              }
            }

            // Function for rendering panel
            function render_panel() {
              if (shouldAbortRender()) {
                return;
              }

              for (var i = 0; i < data.length; i++) {
                var series = data[i];

                var values = _.chain(series.datapoints).reject(function (dp) {
                  return dp[0] === null;
                }).sortBy(function (dp) {
                  return dp[1];
                }).map(function (dp) {
                  return {
                    time: dp[1],
                    value: dp[0]
                  };
                }).groupBy(function (dp) {
                  return dp.time;
                }).map(function (values, time) {
                  return {
                    time: Math.floor(time / 1000),
                    histogram: _.countBy(values, function (value) {
                      return value.value;
                    })
                  };
                }).value();
                series.data = {
                  label: series.label,
                  values: values
                };

                // if hidden remove points
                if (ctrl.hiddenSeries[series.alias]) {
                  series.data = [];
                }
              }

              sortedSeries = _.chain(data).map(function (series) {
                return series.data;
              }).sortBy(function (series) {
                return series.label;
              }).value();

              function callPlot(incrementRenderCounter) {
                try {
                  var heatmapOptions = {
                    type: 'time.heatmap',
                    data: sortedSeries,
                    axes: ['left', 'bottom', 'right'],
                    opacity: function opacity(value, max) {
                      return Math.pow(value / max, 0.7);
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
                  elem.epoch(heatmapOptions);
                } catch (e) {
                  console.log('epoch error', e);
                }

                if (incrementRenderCounter) {
                  ctrl.renderingCompleted();
                }
              }

              if (shouldDelayDraw(panel)) {
                // temp fix for legends on the side, need to render twice to get dimensions right
                callPlot(false);
                setTimeout(function () {
                  callPlot(true);
                }, 50);
                legendSideLastValue = panel.legend.rightSide;
              } else {
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

            function time_format(ticks, min, max) {
              if (min && max && ticks) {
                var range = max - min;
                var secPerTick = range / ticks / 1000;
                var oneDay = 86400000;
                var oneYear = 31536000000;

                if (secPerTick <= 45) {
                  return "%H:%M:%S";
                }
                if (secPerTick <= 7200 || range <= oneDay) {
                  return "%H:%M";
                }
                if (secPerTick <= 80000) {
                  return "%m/%d %H:%M";
                }
                if (secPerTick <= 2419200 || range <= oneYear) {
                  return "%m/%d";
                }
                return "%Y-%m";
              }

              return "%H:%M";
            }

            elem.bind("plotselected", function (event, ranges) {
              scope.$apply(function () {
                timeSrv.setTime({
                  from: moment.utc(ranges.xaxis.from),
                  to: moment.utc(ranges.xaxis.to)
                });
              });
            });
          }
        };
      });
    }
  };
});
//# sourceMappingURL=heatmap.js.map
