const { entrypoints } = require("uxp");
const { action, imaging } = require("photoshop");

entrypoints.setup({});

let websocket = null;
let receivedMessages = [];

const [output, connectionToggleButton, state, url] = [
  "output",
  "connectionToggle",
  "state",
  "url",
].map((el) => document.querySelector(`#${el}`));

const log = (msg) => {
  output.textContent = msg;
};

connectionToggleButton.onclick = async () => {
  if (websocket) {
    await handleWebSocketClose();
  } else {
    websocket = new WebSocket(url.value.trim());

    // WebSocket event handlers
    websocket.onopen = (evt) => {
      handleWebSocketOpen();
    };
    websocket.onclose = async (evt) => {
      await handleWebSocketClose();
    };
    websocket.onmessage = (evt) => {
      handleWebSocketMessage(evt);
    };
    websocket.onerror = (evt) => {
      handleWebSocketError(evt);
    };
  }
};

function handleWebSocketError(evt) {
  console.error("WebSocket error:", evt.message || evt);
  handleWebSocketClose();
}

const sendImageUpdate = async (event, descriptor) => {
  const currentLayer = app.activeDocument.activeLayers[0];
  await sendDataUpdate(currentLayer, "updateImage");

  if (currentLayer.userMaskEnabled) {
    await sendDataUpdate(currentLayer, "updateMask");
  }
};

const sendDataUpdate = async (currentLayer, command) => {
  let data;
  const bounds = {
    left: 0,
    top: 0,
    right: currentLayer.bounds.width,
    bottom: currentLayer.bounds.height,
  };

  if (command === "updateImage") {
    data = await imaging.getPixels({ layerID: currentLayer.layerID, bounds });
  } else if (command === "updateMask") {
    data = await imaging.getLayerMask({
      layerID: currentLayer.layerID,
      bounds,
    });
  }

  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(
      JSON.stringify({
        command: command,
        data: {
          ...data,
          layerName: currentLayer.name,
          data: convertToBase64(data),
        },
      })
    );
  }
};

const convertToBase64 = (pixels) => {
  // TODO
};

async function subscribeToLayerUpdates() {
  await action.addNotificationListener(
    ["historyStateChanged, set, make"],
    sendImageUpdate
  );
}

async function unsubscribeFromLayerUpdates() {
  await action.removeNotificationListener(
    ["historyStateChanged, set, make"],
    sendImageUpdate
  );
}

// Additional functions to modularize the code
function handleWebSocketOpen() {
  try {
    subscribeToLayerUpdates();
    state.className = "positive";
    state.textContent = "Connected";
    updateMenuItemLabel("Disconnect");
    connectionToggleButton.style.backgroundColor = "red";
    connectionToggleButton.textContent = "Disconnect";
    log("Connected");
  } catch (error) {
    console.error("Error handling WebSocket open:", error);
    handleWebSocketClose(); // Close WebSocket on error
  }
}

// Function to handle WebSocket close
async function handleWebSocketClose() {
  try {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.close();
    } else {
      log("Already disconnected.");
    }

    await unsubscribeFromLayerUpdates();
    log("Disconnected");
    state.className = "negative";
    state.textContent = "Disconnected";
    updateMenuItemLabel("Connect");
    connectionToggleButton.style.backgroundColor = "";
    connectionToggleButton.textContent = "Connect";
    websocket = null;
  } catch (error) {
    console.error("Error handling WebSocket close:", error);
  }
}

function handleWebSocketMessage(evt) {
  const [cmd, ...args] = evt.data.split("=");
  receivedMessages.push(evt.data);
  switch (cmd) {
    case "text":
      log(args.join("="));
      break;
    case "err":
      log(`Error from server: ${args.join("=")}`);
      break;
    default:
      log(`Don't know how to ${cmd}`);
  }
}

function updateMenuItemLabel(label) {
  try {
    const panel = entrypoints.getPanel("pomfy");
    if (panel && panel.menuItems && panel.menuItems.length > 0) {
      const menuItem = panel.menuItems.getItemAt(0);
      if (menuItem) {
        menuItem.label = label;
      }
    }
  } catch (error) {
    console.error("Error updating menu item label:", error);
  }
}
