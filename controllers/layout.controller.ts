import {NextFunction,Request,Response} from "express"
import LayoutModel from "../models/layout.model"
import cloudinary from "cloudinary"

//create layout
export const createLayout=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {type} =req.body;
    const isTypeExist=await LayoutModel.findOne({type})
    if (isTypeExist) {
        return res.status(400).json({message:` ${type} Already Exist`})
    }
    if (type=== "Banner") {
        const {image,title,subTitle}=req.body;
        const myCloud=await cloudinary.v2.uploader.upload(image,{
            folder:"layout",
        });
        const banner={
            image:{
        public_id:myCloud.public_id,
        url:myCloud.secure_url,
            },
            title,subTitle
        }
        await LayoutModel.create(banner);

    }
    if (type=== "FAQ") {
const {faq}=req.body
const faqItems=await Promise.all(
    faq.map(async(item:any)=>{
        return{
            question:item.question,
            answer:item.answer
        }
    })
)
await LayoutModel.create({type:"FAQ",faq:faqItems})
    }
    if (type==="Categories") {
    const {categories}=req.body;
    const categoriesItems=await Promise.all(
categories.map(async(item:any)=>{
    return{
        title:item.title
    }
})
        )
        await LayoutModel.create({type:"Categories",categories:categoriesItems})
    }
    res.status(200).json({
        success:true,
        message:"Layout created Succesfully"
    })
} catch (error:any) {
    res.status(500).json({message:error.message})
}
}
export const editLayout=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {type} =req.body
    if (type=== "Banner") {
        const bannerData:any=await LayoutModel.findOne({type:"Banner"})
        const {image,title,subTitle}=req.body;
        if (bannerData) {
            await cloudinary.v2.uploader.destroy(bannerData.image.public_id);

        }
        const myCloud=await cloudinary.v2.uploader.upload(image,{
            folder:"layout"
        })
        const banner={
            type:"Banner",
            image:{
                public_id:myCloud.public_id,
                url:myCloud.secure_url
            },
            title,
            subTitle
        }
        await LayoutModel.findByIdAndUpdate(bannerData._id,{banner})
    }
    if (type === "FAQ") {
        const {faq}=req.body
        const FaqItem=await LayoutModel.findOne({type: "FAQ"})
        const faqItems=await Promise.all(
            faq.map(async(item:any)=>{
                return{
              question:item.question,
              answer:item.answer      
                }
            })
        )
        await LayoutModel.findByIdAndUpdate(FaqItem?._id,{type: "FAQ", faq:faqItems})
    }

    if (type === "Categories") {
        const {categories}=req.body;
        const categoriesData=await LayoutModel.findOne({type:"Categories"})
        const categoriesItems=await Promise.all(
        categories.map(async(item:any)=>{
            return {
                title:item.title,
            }
        })    
        )
        await LayoutModel.findByIdAndUpdate(categoriesData?._id,{
            type:"Categories",
            categories:categoriesItems
        })

    }
    res.status(200).json({
        success:true,
        message:"Layout Updated successfully"
    })
} catch (error:any) {
    res.status(500).json({message:error.message})
}
}

export const getLayoutByType=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {type} =req.body
    const layout=await LayoutModel.findOne({type});
    res.status(201).json({
        success:true,
        layout
    })
} catch (error:any) {
    res.status(500).json({message:error.message})
}
}