require('dotenv').config();
import {Request,Response,NextFunction} from "express"
import userModel,{IUser} from "../models/user.model"
import jwt,{JwtPayload, Secret} from "jsonwebtoken"
import ejs from "ejs"
import path from "path";
import sendMail from "../utils/sendMail";
import { accessTokenOptions, refreshTokenOptions, sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import cloudinary from "cloudinary"
import {getAllUsersService, getUserById, updateUserRoleService} from "../services/user.service"

//register user
interface IRegistrationBody{
name:string;
email:string;
password:string;
avatar?:string
}
export const registerationUser=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const  {name,email,password}=req.body;
    const existingEmail=await userModel.findOne({email}) //Checks if the email is in our database
    if (existingEmail) {
        return res.status(400).json({message:"Email already in use"})      
    }
const user:IRegistrationBody={
    name,email,password
}    
const activationToken=createActivationToken(user);
const activationCode=activationToken.activationCode;

const data={user: {name:user.name},activationCode};
const html=await ejs.renderFile(path.join(__dirname,"../mails/activation-mail.ejs"),data);

try {
    await sendMail({
        email:user.email,
        subject:"Activate your account",
        template:"../mails/activation-mail.ejs",
        data,
    });
    res.status(201).json({success:true,message:`Please check email: ${user.email} to activate your account!`,activationToken:activationToken.token})
} catch (error:any) {
    res.status(400).json({message:error.message})
}

} catch (error:any) {
    res.status(400).json({message:error.message})
}
}
interface IActivationToken{
    token:string;
    activationCode:string;
}
export const createActivationToken=(user:any):IActivationToken=>{
const activationCode=Math.floor(1000+Math.random()*9000).toString();
const token=jwt.sign({
    user,activationCode
},process.env.ACTIVATION_SECRET as Secret,{
    expiresIn:"5m"
});
return {token,activationCode}
}

interface IActivationRequest{
    activation_token:string;
    activation_code:string;
}
export const activateUser=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {activation_token,activation_code}=req.body;
    const newUser:{user:IUser;activationCode:string}=jwt.verify(
        activation_token,process.env.ACTIVATION_SECRET as string
    ) as {user:IUser; activationCode:string};

    if (newUser.activationCode!==activation_code) {
        return res.status(400).json({message:"Invalid activation code"})    
    }
    const {name,email,password}=newUser.user;
    const existUser=await userModel.findOne({email})
    if (existUser) {
        return res.status(400).json({message:"Email Already Exist"})
    }
    const user=await userModel.create({name,email,password})
    res.status(201).json({success:true,})

} catch (error:any) {
    res.status(400).json({message:error.message})
}
}

//Login user
interface ILoginRequest{
    email:string;
    password:string;
}
export const loginUser=async(req:Request,res:Response,next:NextFunction)=>{
    try {
 const {email,password}=req.body as ILoginRequest;
 if (!email || !password) {
    return res.status(400).json({message:"Please fill all fields"})         
 }
 const user=await userModel.findOne({email}).select("+password");
 if (!user) {
    return res.status(400).json({message:"Invalid Email or Password"})       
 }
const isPasswordMatched=await user.comparePassword(password);
if (!isPasswordMatched) {
    return res.status(400).json({message:"Invalid Email or Password"})       
}
sendToken(user,200,res)
    } catch (error:any) {
        res.status(400).json({message:error.message})       
    }
}

export const logoutUser=async(req:Request,res:Response,next:NextFunction)=>{
    try {
res.cookie("access_token","",{maxAge:1})        
res.cookie("refresh_token","",{maxAge:1})        
const userId=req.user?._id || '';
redis.del(userId)
res.status(200).json({
    success:true,
    message:"Logged out successfully"
})
    } catch (error:any) {
        res.status(400).json({message:error.message})              
    }
}
//update access token
export const updateAccessToken=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const refresh_token = req.cookies.refresh_token as string;
    const decoded=jwt.verify(refresh_token,process.env.REFRESH_TOKEN as string) as JwtPayload;
    if (!decoded) {
        return res.status(400).json({message:"Could not refresh token"})       
    }
    const session=await redis.get(decoded.id as string);
    if (!session) {
        return res.status(400).json({message:"Login to access this resource"})          
    }
    const user=JSON.parse(session);

const accessToken=jwt.sign({id:user._id},process.env.ACCESS_TOKEN as string,{
    expiresIn:"5m"
})
const refreshToken=jwt.sign({id:user._id},process.env.REFRESH_TOKEN as string,{
    expiresIn:"3d"
});

req.user=user

res.cookie("access_token",accessToken,accessTokenOptions)
res.cookie("refresh_token",refreshToken,refreshTokenOptions)

await redis.set(user._id,JSON.stringify(user), "EX",604800)

res.status(200).json({
    status:"success",
    accessToken
})
} catch (error:any) {
    res.status(400).json({message:error.message})              
}
}

// get user info
export const getUserInfo=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const userId=req.user?._id;
getUserById(userId,res)
} catch (error:any) {
    res.status(400).json({message:error.message})              
}
}
interface ISocialAuthBody{
    email:string;
    name:string;
    avatar:string;
}
//social Auth
export const socialAuth=async(req:Request,res:Response,next:NextFunction)=>{
    try {
      const {email,name,avatar}=req.body as ISocialAuthBody;
      const user  =await userModel.findOne({email})
      if (!user) {
        const newUser=await userModel.create({email,name,avatar});
        sendToken(newUser,200,res)
      }
      else{
        sendToken(user,200,res)
      }
    } catch (error:any) {
        res.status(400).json({message:error.message})              
    }
    }

    interface IUpdateUserInfo{
        name?:string;
        email?:string
    }
    export const updateUserInfo=async(req:Request,res:Response,next:NextFunction)=>{
  try {
    const {name,email} = req.body as IUpdateUserInfo
    const userId=req.user?._id;
    const user=await userModel.findById(userId)
    if (email && user) {
     const isEmailExist=await userModel.findOne({email}) ;
     if (isEmailExist) {
        return res.status(400).json({message:"Email already exist"})        
     }  
     user.email=email;
    } 
    if(name && user){
user.name=name
    }
    await user?.save();
    await redis.set(userId,JSON.stringify(user))
    res.status(201).json({
        success:true,
        user
    })
  } catch (error:any) {
    res.status(400).json({message:error.message})              
}
}

//update user password
interface IUpdateUserPassword{
    oldPassword:string;
    newPassword:string;
}
export const updatePassword=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {oldPassword,newPassword}=req.body as IUpdateUserPassword

    if (!oldPassword || !newPassword) {
        return res.status(400).json({message:"Fill all fields"})                  
    }
    const user=await userModel.findById(req.user?._id).select("+password");

    if (user?.password ===undefined) {
        return res.status(400).json({message:"Invalid user"})                  
    }

    const isPasswordMatch=await user?.comparePassword(oldPassword);
    if (!isPasswordMatch) {
        return res.status(400).json({message:"Invalid old password"})                          
    }
    user.password=newPassword;
    await user.save()
    await redis.set(req.user?._id,JSON.stringify(user))

    res.status(201).json({
        success:true,
        user
    })
} catch (error:any) {
    res.status(400).json({message:error.message})              
}
}

interface IUpdateProfilePicture{
    avatar:string;
}

export const updateProfilePicture=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {avatar}=req.body;
    const userId=req.user?._id;
    const user=await userModel.findById(userId);

if (avatar && user) {
    if (user?.avatar?.public_id) {
        await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);
        const myCloud=await cloudinary.v2.uploader.upload(avatar,{
            folder:"avatars",
            width:150
        });
    user.avatar={
        public_id:myCloud.public_id,
        url:myCloud.secure_url
    }
    
    }
    else{
    const myCloud=await cloudinary.v2.uploader.upload(avatar,{
        folder:"avatars",
        width:150
    });
user.avatar={
    public_id:myCloud.public_id,
    url:myCloud.secure_url
}

}
    }

    await user?.save()

    await redis.set(userId, JSON.stringify(user));
    res.status(200).json({
        success:true,
        user
    }) 
} catch (error:any) {
    res.status(400).json({message:error.message})              
}
}

//get all users
export const getAllUsers=async(req:Request,res:Response,next:NextFunction)=>{
    try {
        getAllUsersService(res)
    } catch (error:any) {
        res.status(400).json({message:error.message})              
    }
    }

    export const updateUserRole=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {id,role} =req.body
    updateUserRoleService(res,id,role)
} catch (error:any) {
    res.status(400).json({message:error.message})              
}
}

export const deleteUser=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {id} =req.params;
    const user=await userModel.findById(id)
    if (!user) {
 return res.status(404).json({message:"User not Fund"})       
    }
    await user.deleteOne({id})

    await redis.del(id)

    res.status(200).json({
        succeess:true,
        message:"User deleted Successfully"
    })

} catch (error:any) {
    res.status(400).json({message:error.message})              
}
}