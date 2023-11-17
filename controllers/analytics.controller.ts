import {NextFunction,Request,Response} from "express"
import userModel from "../models/user.model";
import {generateLast12MonthsData} from "../utils/analytics.generator"
import OrderModel from "../models/order.Model"
import CourseModel from "../models/course.model";

export const getUserAnalytics=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const users=await generateLast12MonthsData(userModel);
    res.status(200).json({
        success:true,
        users
    })
} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

export const getCoursesAnalytics=async(req:Request,res:Response,next:NextFunction)=>{
    try {
        const courses=await generateLast12MonthsData(CourseModel);
        res.status(200).json({
            success:true,
            courses
        })
    } catch (error:any) {
        res.status(500).json({message:error.message})              
    }
    
}

//get Order analytics
export const getOrderAnalytics=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const orders=await generateLast12MonthsData(OrderModel)
    res.status(200).json({
        success:true,
        orders
    })
} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}