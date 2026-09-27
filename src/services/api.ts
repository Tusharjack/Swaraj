import { authService, initAuthStorage } from './authService';
import { propertyService } from './propertyService';
import { reelService } from './reelService';
import { enquiryService } from './enquiryService';
import { chatService } from './chatService';
import { reportService } from './reportService';
import { getValidUuid, idsEqual, getLastError, setLastError } from './storage';
import { SEED_PROFILES, SEED_PROPERTIES, SEED_REELS } from './seedData';

// Initialize storage seed accounts
initAuthStorage();

export const api = {
  // Auth & User Profiles
  getCurrentUser: authService.getCurrentUser.bind(authService),
  login: authService.login.bind(authService),
  signUp: authService.signUp.bind(authService),
  logout: authService.logout.bind(authService),
  uploadAvatar: authService.uploadAvatar.bind(authService),
  updateProfile: authService.updateProfile.bind(authService),
  getAllUsers: authService.getAllUsers.bind(authService),
  toggleUserVerification: authService.toggleUserVerification.bind(authService),
  updateUserRole: authService.updateUserRole.bind(authService),
  resetPlatformData: authService.resetPlatformData.bind(authService),

  // Properties
  getProperties: propertyService.getProperties.bind(propertyService),
  getPropertyById: propertyService.getPropertyById.bind(propertyService),
  createProperty: propertyService.createProperty.bind(propertyService),
  updatePropertyStatus: propertyService.updatePropertyStatus.bind(propertyService),
  toggleSaveProperty: propertyService.toggleSaveProperty.bind(propertyService),
  getSavedPropertyIds: propertyService.getSavedPropertyIds.bind(propertyService),
  incrementPropertyViews: propertyService.incrementPropertyViews.bind(propertyService),
  uploadPropertyImage: propertyService.uploadPropertyImage.bind(propertyService),
  deleteProperty: propertyService.deleteProperty.bind(propertyService),

  // Video Reels
  getReels: reelService.getReels.bind(reelService),
  getReelsSync: reelService.getReelsSync.bind(reelService),
  getReelById: reelService.getReelById.bind(reelService),
  getReelsForUser: reelService.getReelsForUser.bind(reelService),
  getReelsForUserSync: reelService.getReelsForUserSync.bind(reelService),
  createReel: reelService.createReel.bind(reelService),
  toggleLikeReel: reelService.toggleLikeReel.bind(reelService),
  toggleSaveReel: reelService.toggleSaveReel.bind(reelService),
  toggleFollowCreator: reelService.toggleFollowCreator.bind(reelService),
  getReelComments: reelService.getReelComments.bind(reelService),
  addReelComment: reelService.addReelComment.bind(reelService),
  incrementReelViews: reelService.incrementReelViews.bind(reelService),
  uploadReelMedia: reelService.uploadReelMedia.bind(reelService),
  deleteReel: reelService.deleteReel.bind(reelService),

  // Enquiries & Dashboard
  sendEnquiry: enquiryService.sendEnquiry.bind(enquiryService),
  getEnquiriesForUser: enquiryService.getEnquiriesForUser.bind(enquiryService),
  getAllEnquiries: enquiryService.getAllEnquiries.bind(enquiryService),
  updateEnquiryStatus: enquiryService.updateEnquiryStatus.bind(enquiryService),
  deleteEnquiry: enquiryService.deleteEnquiry.bind(enquiryService),
  getProfessionalDashboard: enquiryService.getProfessionalDashboard.bind(enquiryService),

  // Chat & Messaging
  findOrCreateConversation: chatService.findOrCreateConversation.bind(chatService),
  getChatMessages: chatService.getChatMessages.bind(chatService),
  // These are the method names the UI actually calls:
  getMessagesForEnquiry: chatService.getMessagesForEnquiry.bind(chatService),
  sendMessage: chatService.sendMessage.bind(chatService),
  sendChatMessage: chatService.sendChatMessage.bind(chatService),
  markMessagesAsRead: chatService.markMessagesAsRead.bind(chatService),
  getUnreadCountsByEnquiry: chatService.getUnreadCountsByEnquiry.bind(chatService),

  // Moderation Reports
  submitReport: reportService.submitReport.bind(reportService),
  getAllReports: reportService.getAllReports.bind(reportService),
  getReports: reportService.getAllReports.bind(reportService),
  updateReportStatus: reportService.updateReportStatus.bind(reportService),

  // Diagnostics & Errors
  getLastApiError: getLastError,
  setLastApiError: setLastError
};

export { getValidUuid, idsEqual, SEED_PROFILES, SEED_PROPERTIES, SEED_REELS, getLastError as getLastApiError, setLastError as setLastApiError };
