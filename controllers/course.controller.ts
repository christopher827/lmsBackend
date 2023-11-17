import {NextFunction,Request,Response} from "express"
import cloudinary from "cloudinary"
import {createCourse, getAllCoursesService} from "../services/course.service"
import mongoose from "mongoose";
import path from "path";
import CourseModel from "../models/course.model"
import { redis } from "../utils/redis";
import ejs from "ejs"
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.Model";
import axios from "axios";


//upload course
export const uploadCourse=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const data=req.body;
    const thumbnail=data.thumbnail;
    if (thumbnail) {
        const myCloud=await cloudinary.v2.uploader.upload(thumbnail,{
            folder:"courses"
        });
        data.thumbnail={
            public_id:myCloud.public_id,
            url:myCloud.secure_url
        }
    }
    createCourse(data,res)
} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

//edit course
export const editCourse=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const data=req.body;
    const thumbnail=data.thumbnail;
    if (thumbnail) {
await cloudinary.v2.uploader.destroy(thumbnail.public_id);
const myCloud=await cloudinary.v2.uploader.upload(thumbnail,{
    folder:"courses"
});
data.thumbnail={
    public_id:myCloud.public_id,
    url:myCloud.secure_url
}
    }
const courseId=req.params.id;
const course=await CourseModel.findByIdAndUpdate(
    courseId,
    {
        $set:data
    },
    {new:true}
)
    res.status(201).json({
        success:true,
        course
    })
} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

export const getSingleCourse=async(req:Request,res:Response,next:NextFunction)=>{
try {

    const courseId=req.params.id;
    const isCacheExist=await redis.get(courseId)

if (isCacheExist) {
    const course=await redis.get(courseId)
    res.status(200).json({
        success:true,
        course
    })
}
else{
    const course=await CourseModel.findById(req.params.id).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
    await redis.set(courseId,JSON.stringify(course),"EX",604800)
    res.status(201).json({
        success:true,
        course
    })

}
} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

//get all courses(without purchasing)
export const getAllCourses=async(req:Request,res:Response,next:NextFunction)=>{
    try {
        const isCacheExist=await redis.get("allCourses")
        if (isCacheExist) {
   const courses=JSON.parse(isCacheExist)
   res.status(201).json({
    success:true,
    courses
})
}else{
 const courses=await CourseModel.find().select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links")
 await redis.set("allCourses",JSON.stringify(courses))
 res.status(201).json({
     success:true,
     courses
 })      
}

} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

//get course content (Only for valid user)
export const getCourseByUser=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const userCourseList =req.user?.courses;
    const courseId=req.params.id;

    const courseExists=userCourseList?.find((course:any)=>course._id.toString() === courseId);
    if (!courseExists) {
        return res.status(404).json({message:"You are not eligible to access this course"})                               
    }
const course=await CourseModel.findById(courseId);
const content =course?.courseData;
res.status(201).json({
    success:true,
    content
})

} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

interface IAddQuestionData{
    question:string;
    courseId:string;
    contentId:string;
}
export const addQuestion=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {question,courseId,contentId}:IAddQuestionData= req.body
    const course=await CourseModel.findById(courseId);
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return res.status(400).json({message:"Invalid Content id"})                                     
    }
const courseContent=course?.courseData?.find((item:any)=>item._id.equals(contentId));
if (!courseContent) {
    return res.status(400).json({message:"Invalid Content id"})                                        
}

//create new question object
const newQuestion:any={
    user:req.user,
    question,
    questionReplies:[]
}
courseContent.questions.push(newQuestion)

await NotificationModel.create({
    user:req.user?._id,
    title:"New Question",
    message:`You have a new question in ${courseContent?.title}`
})
//save the updated course
await course?.save()
res.status(201).json({
    success:true,
    course
})

} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

interface IAddAnswerData{
    answer:string;
    courseId:string;
    contentId:string;
    questionId:string;
}
export const addAnswer=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {answer,courseId,contentId,questionId}:IAddAnswerData=req.body
    const course=await CourseModel.findById(courseId);
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return res.status(400).json({message:"Invalid Content id"})                                               
    }
    const courseContent=course?.courseData?.find((item:any)=>{
        item._id.equals(contentId)
    })
    if (!courseContent) {
        return res.status(400).json({message:"Invalid Content id"})                                                     
    }
    const question=courseContent?.questions?.find((item:any)=>
item._id.equals(questionId)
    )
    if (!question) {
        return res.status(400).json({message:"Invalid Content id"})                                                      
    }
    const newAnswer:any={
        user:req.user,
        answer
    }

    //add this question to our course content
    question.questionReplies.push(newAnswer)
    await course?.save()
    if (req.user?._id === question.user._id) {
        //create a notification
        await NotificationModel.create({
            user:req.user?._id,
            title:"New Question Reply Received",
            message:`You have a new question reply in ${courseContent.title}`
        })
    }else{
        const data={
            name:question.user.name,
            title:courseContent.title
        }
        const html=await ejs.renderFile(path.join(__dirname,"../mails/question-reply.ejs"),data);
        try {
     await sendMail({
        email:question.user.email,
        subject:"Question Reply",
        template:"../mails/question-reply.ejs",
        data
     })     
        } catch (error:any) {
        return res.status(500).json({message:error.message})              
        }
        res.status(200).json({
            success:true,
course
        })
            }
} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

interface IAddReviewData{
    review:string;
    rating:number;
    userId:string;
}

export const addReview=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const userCourseList=req.user?.courses;
    const courseId=req.params.id;

    const courseExists=userCourseList?.some((course:any)=>course._id.toString() === courseId.toString());
    if (!courseExists) {
        return res.status(404).json({message:"You're not eligible to access this course"})                                                            
    }
    const course=await CourseModel.findById(courseId)
    const {review,rating} =req.body as IAddReviewData;

    const reviewData:any={
        user:req.user,
        rating,
        comment:review
    }
    course?.reviews.push(reviewData);
    let avg=0
    course?.reviews.forEach((rev:any)=>{
        avg+=rev.rating;
    });

    if (course) {
     course.ratings=avg /course.reviews.length;   
    }
    await course?.save();
    const notification={
        title:"New Review Received",
        message:`${req.user?.name} has given a review in ${course?.name}`
    }

    //create notification
    res.status(200).json({
        success:true,
        course
    })

} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

interface IAddReplyData{
    comment:string;
    courseId:string;
    reviewId:string;
}
export const addReplyToReview=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {comment,courseId,reviewId} =req.body as IAddReplyData
    const course=await CourseModel.findById(courseId);
    if (!course) {
        return res.status(404).json({message:"Course not Found"})                                                            
       
    }
const review=course?.reviews?.find((rev:any)=>rev._id.toString() === reviewId);
if (!review) {
    return res.status(404).json({message:"Review not Found"})                                                             
}
const replyData:any={
    user:req.user,
    comment
}
if(!review.commentReplies){
review.commentReplies=[]
}
review.commentReplies?.push(replyData)
await course?.save()
res.status(200).json({
    success:true,
    course
})
} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

export const getAllUsers=async(req:Request,res:Response,next:NextFunction)=>{
    try {
        getAllCoursesService(res)
    } catch (error:any) {
        res.status(400).json({message:error.message})              
    }
    }

    export const deleteCourse=async(req:Request,res:Response,next:NextFunction)=>{
try {
    const {id}=req.params
    const course=await CourseModel.findById(id)
    if (!course) {
        return res.status(404).json({message:"Course Not Found"})
    }
    await course.deleteOne({id});
    await redis.del(id)
    res.status(200).json({
        success:true,
        message:"Course deleted successfully"
    })
} catch (error:any) {
    res.status(500).json({message:error.message})              
}
}

//generate video url
export const generateVideoUrl=async(req:Request,res:Response,next:NextFunction)=>{
    try {
        const {videoId}=req.body;
        const response=await axios.post(`https://dev.vdocipher.com/api/videos/${videoId}/otp`,
{ttl:300},
{
    headers:{
        Accept:"application/json",
        "Content-Type":"application/json",
        Authorization:`Api secret ${process.env.VDOCIPHER_API_SECRET}`
    }
}
        )
        res.json(response.data)
    } catch (error:any) {
        return res.status(400).json({message:error.message})
    }
}