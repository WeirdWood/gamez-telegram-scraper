const express = require("express");
const app = express();

const api = require("./api");
const auth = require("./auth");

const NA_bot = "gamezbd_na_bot";
const EU_bot = "gamezbd_eu_bot";

//Authenticate when server starts
(async () => {
  await auth.auth(process.env.PHONE_NUMBER);
})();

app.get("/cron", async (request, response) => {
  const botNA = await getBotInfo(NA_bot);
  const botEU = await getBotInfo(EU_bot);

  pressBossBtn(botNA.inputPeer, botNA.msg_id, botNA.buttons);
  await processBossMsg(botNA.msg_id);

  response.status(200).send("Job done!");
});

const listener = app.listen(3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
// const listener = app.listen(process.env.PORT, () => {
//   console.log("Your app is listening on port " + listener.address().port);
// });

async function pressBossBtn(inputPeer, msg_id, buttons) {
  try {
    await api.call("messages.getBotCallbackAnswer", {
      game: false,
      peer: inputPeer,
      msg_id: msg_id,
      data: buttons[1].data,
    });
  } catch (e) {}
}

async function getBotInfo(bot_name) {
  const resolvedPeer = await api.call("contacts.resolveUsername", {
    username: bot_name,
  });

  const inputPeer = {
    _: "inputPeerUser",
    user_id: resolvedPeer.users[0].id,
    access_hash: resolvedPeer.users[0].access_hash,
  };

  const firstHistoryResult = await api.call("messages.getHistory", {
    peer: inputPeer,
    limit: 1,
  });

  const buttons = firstHistoryResult.messages[0].reply_markup.rows[0].buttons;
  const msg_id = firstHistoryResult.messages[0].id;

  return { inputPeer: inputPeer, msg_id: msg_id, buttons: buttons };
}

async function processBossMsg(msg_id) {
  api.getMTProto().updates.on("updates", ({ updates }) => {
    const editedMessages = updates.filter((update) => update._ === "updateEditMessage").map(({ message }) => message);

    editedMessages.forEach((message) => {
      if (message.id === msg_id) {
        console.log(convertMsg(message.message));
      }
    });
  });
}

function convertMsg(msg) {
  msg = msg.substring(msg.indexOf("\n") + 1);
  msg = msg.substring(msg.indexOf("\n") + 1);
  msg = msg.substring(msg.indexOf("\n") + 1);

  var data = msg.split("\n\n");
  var channelData = [];

  data.forEach((channelText) => {
    var ret = {};
    ret.name = channelText.substring(0, channelText.indexOf("\n"));
    ret.bosses = mapLinetoArray(channelText.substring(channelText.indexOf("\n") + 1));
    channelData.push(ret);
  });

  return channelData;
}

function mapLinetoArray(data) {
  var ret = [];
  var splitArr = data.split("\n");

  splitArr.forEach((element) => {
    let bossData = element.split(" spawns ");
    bossData[0] = bossData[0].replace("- ", "");
    bossData[1] = bossData[1].replace(/ *\([^)]*\) */g, "");
    bossData[1] = new Date(bossData[1] + " GMT");
    
    let tmp = { name: bossData[0], time: bossData[1] };
    ret.push(tmp);
  });

  return ret;
}
