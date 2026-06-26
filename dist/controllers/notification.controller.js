"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnreadCount = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// ════════════════════════════════════════════════════════════
// GET /api/notifications
// Patient views all their notifications, latest first
// ════════════════════════════════════════════════════════════
const getNotifications = async (req, res, next) => {
    try {
        const patientId = req.user.id;
        const notifications = await prisma_1.default.notification.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' }
        });
        if (notifications.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No notifications found.',
                data: []
            });
        }
        res.status(200).json({
            success: true,
            message: 'Notifications fetched successfully.',
            data: notifications
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotifications = getNotifications;
// ════════════════════════════════════════════════════════════
// PATCH /api/notifications/:id/read
// Mark a single notification as read
// ════════════════════════════════════════════════════════════
const markAsRead = async (req, res, next) => {
    try {
        const patientId = req.user.id;
        const id = req.params.id;
        const notification = await prisma_1.default.notification.findUnique({
            where: { id }
        });
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found.'
            });
        }
        // Authorization: patient can only access their own notifications
        if (notification.patientId !== patientId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized. You can only access your own notifications.'
            });
        }
        if (notification.isRead) {
            return res.status(400).json({
                success: false,
                message: 'Notification is already marked as read.'
            });
        }
        const updated = await prisma_1.default.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.status(200).json({
            success: true,
            message: 'Notification marked as read.',
            data: updated
        });
    }
    catch (error) {
        next(error);
    }
};
exports.markAsRead = markAsRead;
// ════════════════════════════════════════════════════════════
// PATCH /api/notifications/read-all
// Mark all notifications as read for the logged-in patient
// ════════════════════════════════════════════════════════════
const markAllAsRead = async (req, res, next) => {
    try {
        const patientId = req.user.id;
        const unreadCount = await prisma_1.default.notification.count({
            where: { patientId, isRead: false }
        });
        if (unreadCount === 0) {
            return res.status(200).json({
                success: true,
                message: 'No unread notifications to mark as read.'
            });
        }
        await prisma_1.default.notification.updateMany({
            where: { patientId, isRead: false },
            data: { isRead: true }
        });
        res.status(200).json({
            success: true,
            message: `${unreadCount} notification(s) marked as read.`
        });
    }
    catch (error) {
        next(error);
    }
};
exports.markAllAsRead = markAllAsRead;
// ════════════════════════════════════════════════════════════
// GET /api/notifications/unread-count
// Returns the count of unread notifications
// ════════════════════════════════════════════════════════════
const getUnreadCount = async (req, res, next) => {
    try {
        const patientId = req.user.id;
        const count = await prisma_1.default.notification.count({
            where: { patientId, isRead: false }
        });
        res.status(200).json({
            success: true,
            message: 'Unread notification count fetched successfully.',
            unreadCount: count
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getUnreadCount = getUnreadCount;
