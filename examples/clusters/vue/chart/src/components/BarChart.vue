<template>
    <Line id="my-chart-id" v-if="loaded" :options="chartOptions" :data="chartData" />
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
            // labels: ['January', 'February', 'March'],
            // datasets: [{ data: [40, 20, 12] }]
        }
    },
    async mounted () {
    this.loaded = false

    try {
      const { userlist } = await fetch('/api')
      this.chartdata = userlist

      this.loaded = true
    } catch (e) {
      console.error(e)
    }
  }

}
</script>