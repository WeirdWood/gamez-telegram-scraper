require("dotenv").config();

const express = require("express");
const axios = require("axios");
const sortBy = require("lodash.sortby");
const fs = require("fs");

const api = require("./api");
const auth = require("./auth");

const NA_bot = "gamezbd_na_bot";
const EU_bot = "gamezbd_eu_bot";

const app = express();

//Authenticate when server starts
(async () => {
  await auth.auth(process.env.PHONE_NUMBER);
})();

app.get("/cron", async (request, response) => {
  const [botNA, botEU] = await Promise.all([getBotInfo(NA_bot), getBotInfo(EU_bot)]);

  pressBossBtn(botNA);
  pressBossBtn(botEU);

  botNA.name = "NA";
  botEU.name = "EU";
  await processBossMsg(botNA, botEU);

  response.status(200).send("Job done!");
});
//process.env.PORT
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

async function pressBossBtn(bot) {
  try {
    await api.call("messages.getBotCallbackAnswer", {
      game: false,
      peer: bot.input_peer,
      msg_id: bot.msg_id,
      data: bot.buttons,
    });
  } catch (e) {}
}

async function getBotInfo(name) {
  try {
    let rawdata = fs.readFileSync(`./data/${name}.json`);
    var bot = JSON.parse(rawdata);

    if (process.env.PHONE_NUMBER === bot.phone) {
      bot.buttons = new Uint8Array([bot.buttons[0], bot.buttons[1], bot.buttons[2], bot.buttons[3], bot.buttons[4]]);
      return bot;
    } else {
      return await resolveNewBotData(name);
    }
  } catch (error) {
    return await resolveNewBotData(name);
  }
}

async function resolveNewBotData(name) {
  const inputPeer = await resolveNewInputPeer(name);
  const firstHistoryResult = await api.call("messages.getHistory", {
    peer: inputPeer,
    limit: 1,
  });

  const buttons = firstHistoryResult.messages[0].reply_markup.rows[0].buttons[1].data;
  const msg_id = firstHistoryResult.messages[0].id;

  const bot = { input_peer: inputPeer, msg_id: msg_id, buttons: buttons, phone: process.env.PHONE_NUMBER };
  fs.writeFileSync(`./data/${name}.json`, JSON.stringify(bot));
  return bot;
}

async function resolveNewInputPeer(name) {
  const resolvedPeer = await api.call("contacts.resolveUsername", {
    username: name,
  });
  return {
    _: "inputPeerUser",
    user_id: resolvedPeer.users[0].id,
    access_hash: resolvedPeer.users[0].access_hash,
  };
}

async function processBossMsg(botNA, botEU) {
  var promises = [];
  var na = new Promise(function (resolve, reject) {
    promises.push({ resolve: resolve, reject: reject });
  });
  var eu = new Promise(function (resolve, reject) {
    promises.push({ resolve: resolve, reject: reject });
  });

  api.getMTProto().updates.on("updates", ({ updates }) => {
    const editedMessages = updates.filter((update) => update._ === "updateEditMessage").map(({ message }) => message);

    editedMessages.forEach((message) => {
      if (message.id === botNA.msg_id) {
        postBossMsg(message, botNA).then(() => {
          promises[0].resolve(true);
        });
      } else if (message.id === botEU.msg_id) {
        postBossMsg(message, botEU).then(() => {
          promises[1].resolve(true);
        });
      }
    });
  });

  await Promise.all([na, eu]).then(() => {
    api.getMTProto().updates.removeAllListeners("updates");
  });
}

async function postBossMsg(message, bot) {
  let resultJson = convertMsg(message.message);
  let config = {
    headers: {
      [process.env.PRESHARED_AUTH_HEADER_KEY]: process.env.PRESHARED_AUTH_HEADER_VALUE,
    },
  };

  await axios
    .post(
      `${process.env.CF_WORKER_URL}/bosses`,
      {
        name: bot.name,
        contents: JSON.stringify(resultJson),
      },
      config
    )
    .catch((error) => {
      console.error(error);
    });
}

function convertMsg(msg) {
  msg = msg.substring(msg.indexOf("[GamezBD"));

  let data = msg.split("\n\n");
  let bossesData = [];

  data.forEach((channelText) => {
    let chName = channelText.substring(0, channelText.indexOf("\n"));
	chName = chName.replace(/[{()}]/g, "").replace(/[^\w\s]/gi, '').trim(); //strip brackets -> special chars -> trim whitespace
    let tmp = mapLinetoArray(chName, channelText.substring(channelText.indexOf("\n") + 1));
    bossesData = bossesData.concat(tmp);
  });

  bossesData = sortBy(bossesData, "time");

  return { status: 200, data: bossesData };
}

function mapLinetoArray(chName, data) {
  let ret = [];
  let splitArr = data.split("\n");

  splitArr.forEach((element) => {
    let bossData = element.split(" spawn in ");
    bossData[0] = bossData[0].replace("- ", "");
    bossData[0] = bossData[0].replace(/[^\w\s]/gi, '').trim();
    bossData[1] = bossData[1].replace(" left", "");
    bossData[1] = bossData[1].replace(/h|H|m|M/gi, "");
    let timeTmp = bossData[1].split(" ");

    let timeStamp = Date.now();
    if (timeTmp.length === 1) timeStamp += parseInt(timeTmp[0]) * 60 * 1000;
    else timeStamp += parseInt(timeTmp[0]) * 60 * 60 * 1000 + parseInt(timeTmp[1]) * 60 * 1000;

    console.log(element + " " + timeStamp);
    let bossTime = new Date(parseInt(timeStamp)).toISOString();

    //bossData[1] = bossData[1].replace(/ *\([^)]*\) */g, "");
    //bossData[1] = new Date(bossData[1] + " GMT");

    let tmp = { name: bossData[0], server: chName, time: bossTime };
    ret.push(tmp);
  });

  return ret;
}
