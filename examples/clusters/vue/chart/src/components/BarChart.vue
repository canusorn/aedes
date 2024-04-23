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
        console.log(data)

        this.chartData =data;

        this.loaded = true
      })
      .catch((err) => {
        console.log("error occured", err)
      });


  }
}
</script>