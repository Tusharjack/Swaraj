import { authService, initAuthStorage } from './authService';
import { propertyService } from './propertyService';
import { reelService } from './reelService';
import { enquiryService } from './enquiryService';
import { chatService } from './chatService';
import { reportService } from './reportService';
import { notificationService } from './notificationService';
import { pushService } from './pushService';
import { tokenService } from './tokenService';
import { loanService } from './loanService';
import { referralService } from './referralService';
import { adService } from './adService';
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
  deleteUser: authService.deleteUser.bind(authService),
  resetPlatformData: authService.resetPlatformData.bind(authService),
  deleteAccount: authService.deleteAccount.bind(authService),
  sendPasswordReset: authService.sendPasswordReset.bind(authService),
  updatePassword: authService.updatePassword.bind(authService),
  sendPhoneOtp: authService.sendPhoneOtp.bind(authService),
  verifyPhoneOtp: authService.verifyPhoneOtp.bind(authService),
  onAuthStateChange: authService.onAuthStateChange.bind(authService),
  listMfaFactors: authService.listMfaFactors.bind(authService),
  enrollTotp: authService.enrollTotp.bind(authService),
  verifyTotp: authService.verifyTotp.bind(authService),
  unenrollTotp: authService.unenrollTotp.bind(authService),
  getAssuranceLevel: authService.getAssuranceLevel.bind(authService),

  // Properties
  getProperties: propertyService.getProperties.bind(propertyService),
  getPropertyById: propertyService.getPropertyById.bind(propertyService),
  createProperty: propertyService.createProperty.bind(propertyService),
  updatePropertyStatus: propertyService.updatePropertyStatus.bind(propertyService),
  updateProperty: propertyService.updateProperty.bind(propertyService),
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

  // ── Notifications ─────────────────────────────────────────────────────────
  getNotifications:        notificationService.getNotifications.bind(notificationService),
  getUnreadNotificationCount: notificationService.getUnreadCount.bind(notificationService),
  markNotificationRead:    notificationService.markAsRead.bind(notificationService),
  markAllNotificationsRead: notificationService.markAllAsRead.bind(notificationService),
  deleteNotification:      notificationService.deleteNotification.bind(notificationService),
  subscribeToNotifications: notificationService.subscribeToNotifications.bind(notificationService),
  getSavedPreferences:     notificationService.getPreferences.bind(notificationService),
  saveSavedPreferences:    notificationService.savePreferences.bind(notificationService),
  registerForPush:         pushService.register.bind(pushService),

  // Diagnostics & Errors
  getLastApiError: getLastError,
  setLastApiError: setLastError,

  // ── Token System ─────────────────────────────────────────────────────────
  getMyWallet:            tokenService.getMyWallet.bind(tokenService),
  getMyTransactions:      tokenService.getMyTransactions.bind(tokenService),
  getAllTransactions:      tokenService.getAllTransactions.bind(tokenService),
  getAllWallets:           tokenService.getAllWallets.bind(tokenService),
  adminAdjustTokens:      tokenService.adminAdjustTokens.bind(tokenService),
  spendTokensForPromotion:tokenService.spendTokensForPromotion.bind(tokenService),
  giftCoins:              tokenService.giftCoins.bind(tokenService),
  giftCoinsByPhone:       tokenService.giftCoinsByPhone.bind(tokenService),
  redeemForFeature:       tokenService.redeemForFeature.bind(tokenService),
  redeemForBoost:         tokenService.redeemForBoost.bind(tokenService),
  getPlatformSettings:    tokenService.getPlatformSettings.bind(tokenService),
  updatePlatformSettings:  tokenService.updatePlatformSettings.bind(tokenService),
  expireFeaturedBoosted:  tokenService.expireFeaturedBoosted.bind(tokenService),

  // ── Home Loan ─────────────────────────────────────────────────────────────
  applyForLoan:              loanService.applyForLoan.bind(loanService),
  getMyLoanApplications:     loanService.getMyApplications.bind(loanService),
  getAllLoanApplications:     loanService.getAllApplications.bind(loanService),
  updateLoanStatus:          loanService.updateApplicationStatus.bind(loanService),
  getLoanStats:              loanService.getLoanStats.bind(loanService),

  // ── Referral System ───────────────────────────────────────────────────────
  getMyReferralCode:      referralService.getMyReferralCode.bind(referralService),
  getMyReferrals:         referralService.getMyReferrals.bind(referralService),
  applyReferralCode:      referralService.applyReferralCode.bind(referralService),
  getAllReferrals:         referralService.getAllReferrals.bind(referralService),
  invalidateReferral:     referralService.invalidateReferral.bind(referralService),

  // ── Ad Banners ────────────────────────────────────────────────────────────
  getActiveAds:          adService.getActiveAds.bind(adService),
  getAllAds:             adService.getAllAds.bind(adService),
  createAd:              adService.createAd.bind(adService),
  toggleAdActive:        adService.toggleAdActive.bind(adService),
  deleteAd:              adService.deleteAd.bind(adService),
};

export { getValidUuid, idsEqual, SEED_PROFILES, SEED_PROPERTIES, SEED_REELS, getLastError as getLastApiError, setLastError as setLastApiError };
