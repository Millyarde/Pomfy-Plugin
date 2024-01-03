const { entrypoints } = require("uxp");
const { action, app } = require("photoshop");
const { editDocument } = require("application");

// Setup the panel
entrypoints.setup({
  panels: {
    pomfy: {
      show() {
        // Panel is already populated from the HTML; do nothing
      },
      menuItems: [{ id: "connect", label: "Connect" }],
      invokeMenu(id) {
        handleFlyout(id);
      },
    },
  },
});

// Array of HTML element IDs
const [output, connectionToggleButton, state, url] = [
  "output",
  "connectionToggle",
  "state",
  "url",
].map((el) => document.querySelector(`#${el}`));

// WebSocket and message tracking variables
let websocket = null;
let receivedMessages = [];

// Function to log messages
const log = (msg) => {
  output.textContent = msg;
};

// Event handler for the Connect button
connectionToggleButton.onclick = () => {
  if (websocket) {
    handleWebSocketClose();
  } else {
    websocket = new WebSocket(url.value.trim());

    // WebSocket event handlers
    websocket.onopen = (evt) => {
      handleWebSocketOpen();
    };
    websocket.onclose = (evt) => {
      handleWebSocketClose();
    };
    websocket.onmessage = (evt) => {
      handleWebSocketMessage(evt);
    };
    websocket.onerror = (evt) => {
      log(`Error: ${evt.data}`);
      console.error("WebSocket error:", evt);
      handleWebSocketError(evt);
    };
  }
};

// Function to handle WebSocket errors
function handleWebSocketError(evt) {
  // Additional error handling logic if needed
  // For example, you might want to close the WebSocket connection on error
  handleWebSocketClose();
}

// Function to handle menu item clicks in the panel
function handleFlyout(id) {
  switch (id) {
    case "connect": {
      handleConnectFlyout();
      break;
    }
  }
}

// Updated function to handle menu item clicks in the panel
function handleConnectFlyout() {
  try {
    const panel = entrypoints.getPanel("pomfy");
    if (panel && panel.menuItems && panel.menuItems.length > 0) {
      const menuItem = panel.menuItems.getItemAt(0);
      if (menuItem) {
        if (websocket) {
          handleWebSocketClose();
        } else {
          connectionToggleButton.onclick();
        }
        updateMenuItemLabel(websocket ? "Connect" : "Disconnect");
      }
    }
  } catch (error) {
    console.error("Error handling connect flyout:", error);
  }
}

function subscribeToLayerUpdates() {
  action.addNotificationListener("photoshop.event.notifiers.knot", (event) => {
    if (
      event.eventType === "currentLayerChanged" ||
      event.eventType === "currentMaskChanged"
    ) {
      // Layer or mask has been updated, fetch data and send to the WebSocket server
      const currentLayerName = application.activeDocument.activeLayer.name;
      const imageData = this.getImageData(currentLayerName);
      const maskData = this.getMaskData(currentLayerName);

      // Send data to the WebSocket server
      FromPhotoshop.sendImageAndMask(currentLayerName, imageData, maskData);
    }
  });
}

function unsubscribeFromLayerUpdates() {
  action.removeNotificationListener([], eventNotifier);
}

// Additional functions to modularize the code
function handleWebSocketOpen() {
  subscribeToLayerUpdates();
  state.className = "positive";
  state.textContent = "Connected";
  updateMenuItemLabel("Disconnect");
  connectionToggleButton.style.backgroundColor = "red";
  connectionToggleButton.textContent = "Disconnect";
  log("Connected");
}

// Function to handle WebSocket close
function handleWebSocketClose() {
  if (websocket) {
    websocket.close();
    unsubscribeFromLayerUpdates();
    log("Disconnected");
    state.className = "negative";
    state.textContent = "Disconnected";
    updateMenuItemLabel("Connect");
    connectionToggleButton.style.backgroundColor = "";
    connectionToggleButton.textContent = "Connect";
  } else {
    log("Already disconnected.");
  }
  websocket = null;
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

function setImageData(layerName, imageData) {}

// Function to set mask data to the Photoshop layer
function setMaskData(layerName, maskData) {}
