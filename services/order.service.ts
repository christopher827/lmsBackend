import {NextFunction,Request,Response} from "express"
import OrderModel,{ IOrder } from "../models/order.Model" 

//create new order
export const newOrder=async(data:any,res:Response,next:NextFunction)=>{
const order=await OrderModel.create(data)
res.status(201).json({
    success:true,
    order
})
}

//get all Orders
export const getAllOrdersService=async(res:Response)=>{
    const orders=await OrderModel.find().sort({createdAt:-1})
    res.status(201).json({
        success:true,
        orders
    })

}