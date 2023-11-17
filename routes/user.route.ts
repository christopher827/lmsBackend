import express from "express"
import { activateUser, deleteUser, getAllUsers, getUserInfo, loginUser, logoutUser, registerationUser, socialAuth, updateAccessToken, updatePassword, updateProfilePicture, updateUserInfo, updateUserRole } from "../controllers/user.controller"
import {authorizeRoles, isAuthenticated} from "../middleware/auth"
const userRouter=express.Router();

userRouter.post("/registration",registerationUser)

userRouter.post("/activate-user",activateUser)

userRouter.post("/login-user",loginUser)

userRouter.get("/logout-user",isAuthenticated, logoutUser)

userRouter.get("/refreshtoken",updateAccessToken)

userRouter.get("/me",isAuthenticated,getUserInfo)

userRouter.post("/social-auth",socialAuth)

userRouter.put("/update-user-info",isAuthenticated,updateUserInfo)

userRouter.put("/update-password",isAuthenticated,updatePassword)

userRouter.put("/update-avatar",isAuthenticated,updateProfilePicture)

userRouter.get("/get-users",isAuthenticated, authorizeRoles("admin"),getAllUsers);

userRouter.put("/update-user",isAuthenticated,authorizeRoles("admin"),updateUserRole)

userRouter.delete("/delete-user/:id",isAuthenticated,authorizeRoles("admin"),deleteUser)


export default userRouter