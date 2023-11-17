import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from "jsonwebtoken";
import {redis} from "../utils/redis"

//authenticated user
export const isAuthenticated=async(req:Request,res:Response,next:NextFunction)=>{
const access_token = req.cookies.access_token as string;
if (!access_token) {
    return res.status(401).json({message:"Please login to access this resource"})
}
const decoded=jwt.verify(access_token,process.env.ACCESS_TOKEN as string) as JwtPayload;
if (!decoded) {
    return res.status(400).json({message:"Access token is not valid"})         
}
const user=await redis.get(decoded.id);
if (!user) {
    return res.status(400).json({message:"Please login to access this resource"})         
}
req.user=JSON.parse(user);
next();
}

export const authorizeRoles=(...roles:string[])=>{
    return(req:Request,res:Response,next:NextFunction)=>{
        if (!roles.includes(req.user?.role || '')) {
            return res.status(403).json({message:`Role: ${req.user?.role} is not allowed to access this resources`})                     
        }
    next();
    }
}