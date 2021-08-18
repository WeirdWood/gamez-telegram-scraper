const api = require("./api");
const auth = require("./auth");

const bot_id = 944867319;
const bot_accesshash = "306511632006204548";

(async () => {
  await auth.auth("+84964650325");

  const resolvedPeer = await api.call("contacts.resolveUsername", {
    username: "gamezbd_na_bot",
  });

  const inputPeer = {
    _: "inputPeerUser",
    user_id: resolvedPeer.users[0].id,
    access_hash: resolvedPeer.users[0].access_hash,
  };

  const LIMIT_COUNT = 1;

  const firstHistoryResult = await api.call("messages.getHistory", {
    peer: inputPeer,
    limit: LIMIT_COUNT,
  });

  const buttons = firstHistoryResult.messages[0].reply_markup.rows[0].buttons;
  const msg_id = firstHistoryResult.messages[0].id;

  api.getMTProto().updates.on("updates", ({ updates }) => {
    const editedMessages = updates.filter((update) => update._ === "updateEditMessage").map(({ message }) => message);

    editedMessages.forEach((message) => {
      if (message.id === msg_id) {
        console.log(message.message);
        process.exit();
      }
    });
  });

  try {
    await api.call("messages.getBotCallbackAnswer", {
      game: false,
      peer: inputPeer,
      msg_id: msg_id,
      data: buttons[1].data,
    });
  } catch (e) {}
})();
