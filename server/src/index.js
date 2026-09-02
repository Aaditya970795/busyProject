import "dotenv/config";
import app from "./app.js";
import { startAutoClearSweep } from "./lib/autoClearSweep.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  startAutoClearSweep();
});
