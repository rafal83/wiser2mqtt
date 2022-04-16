const crypto = require("crypto");
const axios = require("axios");
const https = require("https");
const mqtt = require("mqtt");
const moment = require("moment-timezone");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function publishConfigurationForHassDiscovery(
  client,
  hassDiscoveryPrefix,
  mqttBaseTopic,
  mac,
  tag
) {
  const discoveryTopic = `${hassDiscoveryPrefix}/sensor/${mqttBaseTopic}/${mac}_${tag.toLowerCase()}/config`;
  console.log(
    `Publish configuration for tag ${tag} for discovery to topic [${discoveryTopic}]`
  );
  const stateTopic = `${mqttBaseTopic}/${mac}`;
  return client.publish(
    discoveryTopic,
    JSON.stringify({
      unique_id: `wiser_${mac}_${tag}`,
      name: `Wiser ${mac} ${tag}`,
      state_topic: stateTopic,
      state_class: "total_increasing",
      device_class: "energy",
      value_template: `{{ value_json.${tag}.value }}`,
      unit_of_measurement: "Wh",
      device: {
        identifiers: [mac],
        manufacturer: "Wiser",
        model: `wiser_${mac}`,
        name: `Wiser ${mac}`,
      },
    }),
    {
      retain: true,
    }
  );
}

(async () => {
  const config = require("./config.json");

  const client = mqtt.connect(`mqtt://${config.mqtt.host}`, {
    port: config.mqtt.port,
    username: config.mqtt.username,
    password: config.mqtt.password,
  });

  let headersList = {
    authorization: `Bearer ${config.wiser.authorization}`,
    "client-version": "3.9.1",
    cookie: `${config.wiser.cookie}`,
  };

  let reqOptionsDevices = {
    url: "https://fdcs.wiser.schneider-electric.com/api/v1/configurations/site/connections",
    method: "GET",
    headers: headersList,
  };

  let reqOptionsDelta = {
    url: "https://fdcs.wiser.schneider-electric.com/api/v3/data/delta?cost=true&groupBy=hour&",
    method: "GET",
    headers: headersList,
  };

  let reqOptions = {
    url: "https://fdcs.wiser.schneider-electric.com/api/v3/data/instantvalues?cost=true",
    method: "GET",
    headers: headersList,
  };

  const devicesAvailable = await axios
    .request(reqOptionsDevices)
    .then((response) => {
      return response.data;
    });
  let devices = [];

  Object.keys(devicesAvailable.devices).forEach((mac) => {
    devices.push({
      mac: mac,
      meters: Object.keys(devicesAvailable.devices[mac].meters).sort(),
    });
  });

  for (const device of devices) {
    for (const meter of device.meters) {
      await publishConfigurationForHassDiscovery(
        client,
        config.homeassistant.prefix,
        "wiser",
        device.mac,
        meter
      );
    }
  }

  while (true) {
    let from = moment().tz(config.timezone).format("YYYY-MM-DDT00:00:00Z");
    let to = moment().tz(config.timezone).format("YYYY-MM-DDT23:59:59Z");

    reqOptionsDelta.url =
      `https://fdcs.wiser.schneider-electric.com/api/v3/data/delta?cost=true&groupBy=day&from=${from}&to=${to}`.replace(
        /\+/g,
        "%2B"
      );

    for (const device of devices) {
      axios.request(reqOptionsDelta).then(async (response) => {
        let meters = {};
        for (const meter of device.meters) {
          meters[meter] = { value: response.data.meters[meter].delta };
        }

        await client.publish(`wiser/${device.mac}`, JSON.stringify(meters));

        console.log(new Date(), "DELTA", JSON.stringify(meters));
      });
    }

    await delay(config.delay);
  }
})();
