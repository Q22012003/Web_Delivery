import express from "express";
import carRoutes from "./routes/carRoutes.js";

const app = express();
app.use(express.json());

app.use("/car", carRoutes);

export default app;
