var template = `
<link rel="stylesheet" href="/public/plugins/grafana-heatmap-epoch-panel/bower_components/epoch/dist/css/epoch.min.css">
<div class="graph-wrapper" ng-class="{'graph-legend-rightside': ctrl.panel.legend.rightSide}">
  <div class="graph-canvas-wrapper">

    <div ng-if="datapointsWarning" class="datapoints-warning">
      <span class="small" ng-show="!datapointsCount">
        No datapoints <tip>No datapoints returned from metric query</tip>
      </span>
      <span class="small" ng-show="datapointsOutside">
        Datapoints outside time range
        <tip>Can be caused by timezone mismatch between browser and graphite server</tip>
      </span>
    </div>

    <div grafana-heatmap-epoch class="epoch-theme-dark" ng-dblclick="ctrl.zoomOut()">
    </div>

  </div>

  <div class="graph-legend-wrapper" graph-legend></div>
  </div>

<div class="clearfix"></div>
`;

export default template;
