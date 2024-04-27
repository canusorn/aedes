<template>
  <div class="container">
    <Line id="my-chart-id" v-if="loaded" :data="chartData" />
  </div>
</template>

<script>
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend)

export default {
  name: 'BarChart',
  components: { Line },
  data() {
    return {
      loaded: false,
      chartData: null
    }
  },
  async mounted() {

    this.loaded = false

    fetch("http://192.168.0.101:3000/api")
      .then((res) => res.json())
      .then((data) => {
        console.log(typeof data)
        console.log(data)

        let size = Object.keys(data[0]).length;
        // console.log("object size : " + size);

        var dataout = { labels: [], datasets: [] }


        let labels = [], datasets = [];

        data.forEach((document) => {

          for (let i = 1; i <= size - 2; i++) {
            if (!datasets[i - 1]) {
              datasets.push({ label: Object.keys(data[0])[i], data: [] })
            }
            datasets[i - 1].data.push(Object.values(document)[i])
          }
            labels.push(Object.values(document)[size - 1])

        });


        dataout.labels = labels;
        dataout.datasets = datasets;


        this.chartData = dataout;

        this.loaded = true
      })
      .catch((err) => {
        console.log("error occured", err)
      });


  }
}
</script>