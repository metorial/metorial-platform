import { theme } from '@metorial/ui';
import { ApexOptions } from 'apexcharts';
import { memo, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';

export let Chart = memo(
  ({
    height = 300,
    type = 'line',
    series: rawSeries
  }: {
    height?: number;
    type?: 'line' | 'bar-vertical' | 'bar-horizontal' | 'pie';
    series: {
      id: string;
      name: string;
      entries: {
        key: number | string | Date;
        value: number;
      }[];
    }[];
  }) => {
    let series = useMemo(() => {
      if (type == 'line') {
        return rawSeries.map(timeline => ({
          name: timeline.name,
          data: timeline.entries.map(entry => ({
            x: entry.key,
            y: entry.value
          }))
        }));
      }

      if (type == 'bar-horizontal' || type == 'bar-vertical') {
        return rawSeries.map(timeline => ({
          name: timeline.name,
          data: timeline.entries.map(entry => entry.value)
        }));
      }

      if (type == 'pie') {
        return rawSeries.flatMap(t => t.entries.map(e => e.value));
      }

      throw new Error(`Unsupported chart type: ${type}`);
    }, [rawSeries, type]);

    let options = useMemo(
      () =>
        ({
          colors: [
            theme.colors.red600,
            theme.colors.green800,
            theme.colors.blue800,
            theme.colors.yellow800,
            theme.colors.purple800,
            theme.colors.orange800
          ],
          chart: {
            type: type == 'line' ? 'area' : type == 'pie' ? 'pie' : 'bar',
            height: 350,
            zoom: {
              enabled: false
            },
            toolbar: {
              show: false
            },
            animations: {
              enabled: false
            }
          },
          dataLabels: {
            enabled: false
          },

          labels:
            type == 'pie' ? rawSeries.flatMap(t => t.entries.map(e => String(e.key))) : [],

          plotOptions:
            type == 'bar-vertical'
              ? {
                  bar: {
                    borderRadius: 4,
                    horizontal: false,
                    borderRadiusApplication: 'end'
                  }
                }
              : {
                  bar: {
                    borderRadius: 4,
                    borderRadiusApplication: 'end',
                    horizontal: true
                  }
                },

          fill:
            type == 'pie'
              ? {}
              : {
                  type: 'gradient',
                  gradient: {
                    shadeIntensity: 1,
                    inverseColors: false,
                    opacityFrom: 0.5,
                    opacityTo: 0,
                    stops: [0, 90, 100]
                  }
                },

          stroke: {
            width: 2
          },

          yaxis:
            type == 'line'
              ? {}
              : type == 'bar-horizontal' || type == 'bar-vertical'
                ? {
                    title: {
                      text: undefined
                    }
                  }
                : {
                    title: {
                      text: undefined
                    }
                  },

          xaxis:
            type == 'line'
              ? {
                  type: 'datetime'
                }
              : type == 'bar-horizontal' || type == 'bar-vertical'
                ? {
                    categories: ['Submissions']
                  }
                : {},

          tooltip:
            type == 'line'
              ? {
                  shared: true,
                  x: {
                    format: 'dd MMM yyyy HH:mm'
                  }
                }
              : {}
        }) satisfies ApexOptions,
      [type]
    );

    return (
      <ReactApexChart
        options={options}
        series={series}
        type={type == 'line' ? 'area' : type == 'pie' ? 'pie' : 'bar'}
        height={height}
      />
    );
  }
);
