import NotificationModel  from "../models/notification.Model"
import {NextFunction,Request,Response} from "express"
import cron from "node-cron"

export const getNotifications=async(req:Request,res:Response,next:NextFunction)=>{
    try {
     const notifications=await NotificationModel.find().sort({createdAt:-1});
     res.status(201).json({
        success:true,
        notifications
     })   
    } catch (error:any) {
        res.status(500).json({message:error.message})
    }
    };

export const updateNotification=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const notification=await NotificationModel.findById(req.params.id);
    if (!notification) {
        return res.status(404).json({message:"Notification not found"})           
    }
    else{
        notification.status?(notification.status="read") : notification?.status;
    }
    await notification.save();
    const notifications=await NotificationModel.find().sort({
        createdAt:-1,
    });
    res.status(201).json({
        success:true,
        notifications
    })
} catch (error:any) {
    res.status(500).json({message:error.message})
}
}

//delete notification
cron.schedule("0 0 0 * * * ",async()=>{
    const thirtyDaysAgo=new Date(Date.now() - 30 * 24 * 60 * 1000)
    await NotificationModel.deleteMany({status:"read",createdAt:{$lt:thirtyDaysAgo}})
    console.log("Deleted read notifications")
})