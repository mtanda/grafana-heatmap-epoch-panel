## Heatmap (Epoch) Panel Plugin for Grafana

**Caution: This plugin is NOT stable yet, if you find some bugs, please report me :-)**

This plugin show the Heatmap of time series data.

![](https://raw.githubusercontent.com/mtanda/grafana-heatmap-epoch-panel/master/dist/images/heatmap.png)

### How this plugin works

This plugin receives raw time series data, and convert the data to heatmap data in plugin side, and then show it by [Epoch](http://epochjs.github.io/epoch/).

To make heatmap data, make histogram data in fixed short time range. The aggregation time range is calculated from Epoch window size options, please calibrate the option to fit your needs.

### Supported Datasources

I confirmed this plugin work with following datasource.

- Prometheus

But, this plugin can handle time series data (defined by Grafana plugin interface).

Should work with Graphite / InfluxDB / OpenTSDB.

### Options

Support some of Epoch options.

- Window Size
- Buckets
- BucketLower and BuckerUpper (correspond to bucketRange)

Please read [official document](http://epochjs.github.io/epoch/real-time/#heatmap), to get to know actual meaning of these options.

### Known Issues

- This plugin doesn't support Elasticsearch aggregation.
  - As noted above, this plugin aggregate the time series data by plugin itself.
  - Can't handle the Elasticsearch aggregation result yet.

- This plugin doesn't support some of Graph panel feature.
  - Because Epoch library doesn't support some of Flot library feature (Graph panel use Flot)
  - Doesn't support Time range selection by clicking panel, Tooltip, Annotation, Draw threshold lines, etc...

------

#### Changelog

##### v0.1.7
- Increase the supported number of time series

##### v0.1.6
- Add auto bucket range mode

##### v0.1.5
- Fixed user preference timezone handling

##### v0.1.4
- Fixed sparse data handling
- Fixed heatmap color, follow Grafana standard color
- Fixed legend drawing

##### v0.1.3
- Added support legend

##### v0.1.2
- Added support theme
- Fixed axis character colors
- Fixed time axis, make it more intuitive

##### v0.1.1
- Fixed container resize handling, redraw graph to fit container size
- Fixed ticks, show ticks like graph panel
