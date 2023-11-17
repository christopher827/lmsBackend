require('dotenv').config();
import express from "express"
import connectDB from "./utils/db"
import { v2 as cloudinary } from "cloudinary";
import cookieParser from "cookie-parser";
import cors from "cors"
import userRouter from "./routes/user.route";
import courseRouter from "./routes/course.routes"
import orderRouter from "./routes/order.route"
import notificationRouter from "./routes/notification.route"
import analyticsRouter from "./routes/analytics.routes"
import layoutRouter from "./routes/layout.route"
const app=express();

app.use(cors({
    origin:process.env.ORIGIN,
    credentials:true,
    methods: ['GET', 'POST','PUT'], // Specify the allowed HTTP methods
  
  })) //Cross-Origin Resource Sharing Middleware
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' })); 
//Connect dataBase
connectDB()

//cloudinary config
cloudinary.config({
  cloud_name:process.env.CLOUD_NAME,
  api_key:process.env.CLOUD_API_KEY,
api_secret:process.env.CLOUD_SECRET_KEY
})

//routes
app.use("/api/v1",userRouter)

app.use("/api/v1",courseRouter)

app.use("/api/v1",orderRouter)

app.use("/api/v1",notificationRouter)

app.use("/api/v1",analyticsRouter)

app.use("/api/v1",layoutRouter)

  app.get("/test",(req,res)=>{
res.status(200).json({success:true,message:"Working perfectly"})
  })

  app.all("*",(req,res)=>{
    return res.status(404).json({message:`Route ${req.originalUrl} not found`})
  })
  app.listen(process.env.PORT,()=>{
    console.log(`Server running on PORT ${process.env.PORT}`)
  })