'use strict';

System.register(['angular', 'jquery', 'moment', 'lodash', 'app/core/utils/kbn', './bower_components/d3/d3.min.js', './bower_components/epoch/dist/js/epoch.js'], function (_export, _context) {
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
    }, function (_bower_componentsD3D3MinJs) {}, function (_bower_componentsEpochDistJsEpochJs) {}],
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
            var epoch = null;
            var labelToModelIndexMap = {};
            var startTime = null;
            var currentDatasource = '';

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

              if (elem.width() === 0) {
                return true;
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

            function callPlot(incrementRenderCounter) {
              try {
                epoch = elem.epoch(panel.heatmapOptions);
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

              if (panel.datasource !== currentDatasource) {
                startTime = Math.floor(ctrl.range.from.valueOf() / 1000);
                epoch = null;
              }
              currentDatasource = panel.datasource;

              var delta = true;
              var seriesData = _.map(data, function (series, i) {
                delta = delta && series.color; // use color as delta temporaly, if all series is delta, enable realtime chart

                // if hidden remove points
                if (ctrl.hiddenSeries[series.alias]) {
                  return [];
                }

                var result = [];
                var minIndex = Number.MAX_VALUE;
                _.chain(series.datapoints).reject(function (dp) {
                  return dp[0] === null;
                }).groupBy(function (dp) {
                  return Math.floor(dp[1] / panel.heatmapOptions.ticks.time / 1000); // group by time
                }).map(function (values, timeGroupKey) {
                  return [
                  // time
                  Math.floor(timeGroupKey * panel.heatmapOptions.ticks.time),
                  // count
                  _.chain(values).map(function (value) {
                    return value[0]; // pick value
                  }).countBy(function (value) {
                    return value;
                  }).value()];
                }).each(function (v) {
                  var index = v[0] - startTime;
                  if (index < minIndex) {
                    minIndex = index;
                  }
                  result[index] = v[1];
                });

                return result;
              });

              if (epoch && delta) {
                var indexedData = [];
                var dataLength = 0;
                _.each(data, function (series) {
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
                    return dp.time / panel.heatmapOptions.ticks.time;
                  }).map(function (values, time) {
                    return {
                      time: Math.floor(time * panel.heatmapOptions.ticks.time / 1000),
                      histogram: _.countBy(values, function (value) {
                        return value.value;
                      })
                    };
                  }).value();

                  if (!_.isUndefined(labelToModelIndexMap[series.label])) {
                    indexedData[labelToModelIndexMap[series.label]] = values;
                    if (dataLength < values.length) {
                      dataLength = values.length;
                    }
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
              } else {
                var labels = _.map(data, function (series) {
                  return series.label;
                });
                _.each(data, function (series, i) {
                  labelToModelIndexMap[series.label] = i;
                });

                panel.heatmapOptions.startTime = startTime;

                var model = new Epoch.Model({ dataFormat: 'array', startTime: startTime, labels: labels });
                model.setData(seriesData);
                panel.heatmapOptions.model = model;

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
