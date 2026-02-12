const blessed = require("blessed");

console.log("Attempting to start blessed screen...");

try {
  const screen = blessed.screen({
    smartCSR: true,
    title: "Blessed Test",
    fullUnicode: true,
  });

  const box = blessed.box({
    top: "center",
    left: "center",
    width: "50%",
    height: "50%",
    content: "Blessed screen started successfully! Press any key to exit.",
    border: {
      type: "line",
    },
    style: {
      fg: "white",
      bg: "blue",
    },
  });

  screen.append(box);
  screen.key(["escape", "q", "C-c", "enter", "space"], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.render();
  console.log("Blessed screen rendered. Check your terminal window.");
} catch (error) {
  console.error("--- BLESSED LIBRARY FAILED TO START ---");
  console.error(error);
  console.error("--- END OF ERROR ---");
  process.exit(1);
}
