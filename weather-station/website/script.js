// Constants
const MessageType = {
    INIT_DEVICES: 1,
    NEW_DEVICE: 2,
    INIT_MEASUREMENTS: 3,
    NEW_MEASUREMENTS: 4
};

const MeasurementType = {
    TEMPERATURE: 1,
    HUMIDITY: 2,
    LIGHTNESS: 3
};

// Utils
function bytes2uuid(bytes) {
    let pos = 0;
    let uuid = '';
    for (let i = 0; i < 4; i++) uuid += bytes[pos++].toString(16).padStart(2, '0');
    uuid += '-';
    for (let i = 0; i < 2; i++) uuid += bytes[pos++].toString(16).padStart(2, '0');
    uuid += '-';
    for (let i = 0; i < 2; i++) uuid += bytes[pos++].toString(16).padStart(2, '0');
    uuid += '-';
    for (let i = 0; i < 2; i++) uuid += bytes[pos++].toString(16).padStart(2, '0');
    uuid += '-';
    for (let i = 0; i < 6; i++) uuid += bytes[pos++].toString(16).padStart(2, '0');
    return uuid;
}

function decodeDevice(buffer, pos) {
    const view = new DataView(buffer);
    const device = {};
    device.id = bytes2uuid(new Uint8Array(buffer, pos, 16)); pos += 16;

    const nameLength = view.getUint16(pos, true); pos += 2;
    device.name = new TextDecoder().decode(new Uint8Array(buffer, pos, nameLength)); pos += nameLength;

    device.temperatureMeasurements = [];
    device.humidityMeasurements = [];
    device.lightnessMeasurements = [];
    return { device, pos };
}

// Components
Vue.component('measurements-chart', {
    props: ['label', 'color', 'measurements'],

    template: `<div class="box">
        <h2>{{ label }}</h2>
        <canvas ref="chart"></canvas>
    </div>`,

    watch: {
        measurements() {
            this.updateChart();
        }
    },

    mounted() {
        this.updateChart();
    },

    methods: {
        updateChart() {
            if (this.chart == undefined) {
                this.chart = new Chart(this.$refs.chart.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: this.measurements.map(measurement => new Date(measurement.created_at * 1000).toLocaleTimeString()),
                        datasets: [{
                            label: this.label,
                            data: this.measurements.map(measurement => measurement.value),
                            borderColor: this.color
                        }]
                    }
                });
            } else {
                this.chart.data.labels = this.measurements.map(measurement => new Date(measurement.created_at * 1000).toLocaleTimeString());
                this.chart.data.datasets[0].data = this.measurements.map(measurement => measurement.value);
                this.chart.update();
            }
        }
    }
});

// App
const app = new Vue({
    el: '#app',

    data() {
        return {
            connected: false,
            devices: []
        }
    },

    created() {
        this.connect();
    },

    methods: {
        connect() {
            const ws = new WebSocket('ws://localhost:8080/ws');
            ws.binaryType = 'arraybuffer';
            ws.onopen = this.onOpen.bind(this);
            ws.onmessage = this.onMessage.bind(this);
        },

        onOpen() {
            this.connected = true;
        },

        onMessage(event) {
            // Read incoming message type
            const messageView = new DataView(event.data);
            let pos = 0;
            const type = messageView.getUint8(pos++);

            // Init devices message
            if (type == MessageType.INIT_DEVICES) {
                this.devices = [];
                const devicesLength = messageView.getUint32(pos, true); pos += 4;
                for (let i = 0; i < devicesLength; i++) {
                    const { device, pos: newPos } = decodeDevice(event.data, pos);
                    pos = newPos;
                    this.devices.push(device);
                }
            }

            // New device messages
            if (type == MessageType.NEW_DEVICE) {
                const { device } = decodeDevice(event.data, pos);
                this.devices.push(device);
            }

            // Init or new measurements messages
            if (type == MessageType.INIT_MEASUREMENTS || type == MessageType.NEW_MEASUREMENTS) {
                const measurementsLength = messageView.getUint32(pos, true); pos += 4;
                for (let i = 0; i < measurementsLength; i++) {
                    const measurement = {};
                    measurement.id = bytes2uuid(new Uint8Array(event.data, pos, 16)); pos += 16;
                    measurement.device_id = bytes2uuid(new Uint8Array(event.data, pos, 16)); pos += 16;
                    measurement.type = messageView.getUint8(pos++);
                    measurement.value = messageView.getFloat32(pos, true); pos += 4;
                    measurement.created_at = messageView.getUint32(pos, true); pos += 4;

                    const device = this.devices.find(device => device.id == measurement.device_id);
                    if (measurement.type == MeasurementType.TEMPERATURE) {
                        device.temperatureMeasurements.push(measurement);
                    }
                    if (measurement.type == MeasurementType.HUMIDITY) {
                        device.humidityMeasurements.push(measurement);
                    }
                    if (measurement.type == MeasurementType.LIGHTNESS) {
                        device.lightnessMeasurements.push(measurement);
                    }
                }
            }
        }
    }
});
