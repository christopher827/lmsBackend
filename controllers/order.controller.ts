import {NextFunction,Request,Response} from "express"
import OrderModel, {IOrder} from "../models/order.Model"
import userModel from "../models/user.model"
import CourseModel from "../models/course.model"
import path from "path"
import ejs from "ejs"
import sendMail  from "../utils/sendMail"
import NotificationModel from "../models/notification.Model"
import { getAllOrdersService, newOrder } from "../services/order.service"

export const createOrder=async(req:Request,res:Response,next:NextFunction)=>{
    try {
    const {courseId,payment_info}=req.body as IOrder;
    const user=await userModel.findById(req.user?._id)
    const courseExistInUser=user?.courses.some((course:any)=>course._id.toString()===courseId);
    if (courseExistInUser) {
        return res.status(400).json({message:"You already purchased this course"})      
    }
const course=await CourseModel.findById(courseId);
if (!course) {
    return res.status(400).json({message:"Course not found"})      
}
const data:any={
    courseId:course._id,
    userId:user?._id,
    payment_info
}
const mailData={
    order:{
    _id:course._id.toString().slice(0,6),
    name:course.name,
    price:course.price,
    date:new Date().toLocaleDateString('en-US',{year:"numeric",month:"long",day:"numeric"})    
    }
}
const html=await ejs.renderFile(path.join(__dirname,"../mails/order-confirmation.ejs"),{order:mailData})
try {
    if (user) {
    await sendMail({
        email:user.email,
        subject:"Order Confirmation",
        template:"order-confirmation.ejs",
        data:mailData,
    })
    }
} catch (error:any) {
  return res.status(500).json({message:error.message})
}
user?.courses.push(course?._id);
await user?.save();
await NotificationModel.create({
    user:user?._id,
    title:"New Order",
    message:`You have a new order from ${course?.name}`
});
course.purchased ? course.purchased +=1 : course.purchased
await course.save()
newOrder(data,res,next);

    } catch (error:any) {
        res.status(500).json({message:error.message})
 
    }
}

//get all orders
export const getAllOrders=async(res:Response)=>{
try {
    getAllOrdersService(res)
} catch (error:any) {
    res.status(500).json({message:error.message})

}
}