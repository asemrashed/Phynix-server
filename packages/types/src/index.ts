import type { QuizLessonContent } from "./schemas/quiz"
import type { ConsultationType } from "./consultation"

// ─── API Response Wrappers ───────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiErrorBody {
  code: string
  message: string
}

export interface ApiFailure {
  success: false
  error: ApiErrorBody
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Auth ────────────────────────────────────────────────────────────

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "INSTRUCTOR"
  | "STUDENT"

export type DeviceType = "PC" | "MOBILE"

export type RegistrationType = "STUDENT"

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  country?: string
}

export interface UpdateProfileRequest {
  firstName?: string
  lastName?: string
  phone?: string
  country?: string
}

export interface LoginRequest {
  email: string
  password: string
  deviceFingerprint: string
  deviceType: DeviceType
  /** When true, clears existing device sessions after credential check (login screen force logout). */
  forceLogout?: boolean
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}

export interface StudentProfile {
  id: string
  uniqueStudentId: string | null
  firstName: string
  lastName: string
  phone: string | null
  country: string
  avatarUrl: string | null
  registrationType: RegistrationType | string
  memberSince?: string
}

export interface StudentPortfolio {
  profile: StudentProfile
  stats: {
    coursesEnrolled: number
    coursesCompleted: number
    certificates: number
    learningHours: number
  }
  enrollments: Array<{
    id: string
    progress: number
    enrolledAt: string
    completedAt: string | null
    course: {
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
      level: string
    }
  }>
  certificates: CertificateItem[]
}

export interface StudentCvExperienceItem {
  title: string
  organization: string
  year: string
  description?: string
}

export interface StudentCvDraft {
  headline?: string
  summary?: string
  skills: string[]
  experience: StudentCvExperienceItem[]
  contactEmail?: string
  contactPhone?: string
  includeCertificates: boolean
  includeCompletedCourses: boolean
}

export interface StudentCvResponse {
  draft: StudentCvDraft
  portfolio: StudentPortfolio
}

export interface AuthUser {
  id: string
  email: string
  role: Role
  isVerified: boolean
  student: StudentProfile | null
}

export interface DeviceLimitError {
  code: "DEVICE_LIMIT_REACHED"
  message: string
  deviceType: DeviceType
}

// ─── Courses ─────────────────────────────────────────────────────────

export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED"
export type LessonType = "VIDEO" | "TEXT" | "QUIZ"
export type VideoProvider = "VIMEO" | "YOUTUBE" | "SELF_HOSTED"

export interface CourseListItem {
  id: string
  title: string
  slug: string
  description: string
  thumbnailUrl: string | null
  price: number
  originalPrice: number | null
  currency: string
  level: CourseLevel
  language: string
  isFeatured: boolean
  totalDuration: number
  instructorName: string
  instructorBio?: string | null
  instructorPhotoUrl?: string | null
  enrollmentCount: number
  averageRating: number
  reviewCount?: number
  isEnrolled?: boolean
  progress?: number
}

export interface LessonItem {
  id: string
  title: string
  type: LessonType
  duration: number
  order: number
  isFree: boolean
  isCompleted?: boolean
  watchPosition?: number
}

export interface SectionItem {
  id: string
  title: string
  order: number
  lessons: LessonItem[]
}

export interface CourseReviewItem {
  id: string
  rating: number
  review: string | null
  studentName: string
  createdAt: string
  isOwn?: boolean
}

export interface SubmitCourseReviewRequest {
  rating: number
  review?: string
}

export interface CourseFaqItem {
  question: string
  answer: string
}

export interface CourseInstructorStats {
  averageRating: number
  totalStudents: number
  courseCount: number
}

export interface CourseInstallmentPlanSummary {
  label: string
  installmentCount: number
}

export interface CourseDetail extends CourseListItem {
  subtitle: string | null
  badgeLabel: string | null
  highlights: string[]
  faqs: CourseFaqItem[]
  discountEndsAt: string | null
  seatLimit: number | null
  seatsRemaining: number | null
  startsAt: string | null
  classSchedule: string | null
  deliveryType: string | null
  refundDays: number | null
  instructorTitle: string | null
  instructorStats: CourseInstructorStats | null
  installmentPlan: CourseInstallmentPlanSummary | null
  learningOutcomes: string[]
  sections: SectionItem[]
  status: CourseStatus
  isEnrolled: boolean
  progress: number
  myReview?: CourseReviewItem | null
  canReview?: boolean
  hasReviewed?: boolean
  certificateStatus?: string | null
}

export interface EnrollmentProgress {
  enrollmentId: string
  courseId: string
  progress: number
  completedLessons: number
  totalLessons: number
  lastLessonId: string | null
  lastLessonTitle: string | null
  watchPosition?: number
}

export interface StudentEnrollmentItem {
  id: string
  progress: number
  enrolledAt: string
  lastLessonId: string | null
  lastLessonTitle: string | null
  watchPosition: number
  totalLessons: number
  completedLessons: number
  course: {
    id: string
    title: string
    slug: string
    thumbnailUrl: string | null
    level: string
    language: string
  }
}

export interface LessonProgressUpdate {
  watchPosition?: number
  isCompleted?: boolean
  quizAnswers?: Record<string, number>
}

export interface TextLessonContent {
  html: string
}

export interface VideoLessonContent {
  provider: VideoProvider
  videoRef: string | null
}

export type StudentLessonContent =
  | QuizLessonContent
  | TextLessonContent
  | VideoLessonContent

export interface StudentLessonDetail {
  id: string
  title: string
  type: LessonType
  duration: number
  content: StudentLessonContent
  isCompleted: boolean
  quizScore: number | null
  quizAttemptsUsed: number
  quizAttemptsRemaining: number
}

export interface LessonProgressResult {
  progress: number
  isCompleted: boolean
  quizScore?: number
  quizPassed?: boolean
  quizAttemptsUsed?: number
  quizAttemptsRemaining?: number
  quizPerQuestion?: import("./schemas/quiz").QuizQuestionResultItem[]

  /** Set when quiz passed on submit */
  quizReview?: import("./schemas/quiz").QuizLessonContent["review"]
}

export interface VideoTokenResponse {
  provider: VideoProvider
  embedUrl?: string
  streamUrl?: string
  expiresAt: string
  watchPosition: number
  duration: number
  sessionToken: string
  isCompleted: boolean
}

// ─── Payments ────────────────────────────────────────────────────────

export type PaymentGateway = "sslcommerz"
export type ManualPaymentProvider = "bkash" | "nagad"
export type PaymentStatus =
  | "PENDING"
  | "AWAITING_VERIFICATION"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED"
  | "EXPIRED"
  | "REFUNDED"

export interface PaymentGatewayOption {
  id: PaymentGateway
  label: string
  currency: "BDT"
  configured: boolean
  available: boolean
  manual?: boolean
}

export interface ManualPaymentMethodConfig {
  id: ManualPaymentProvider
  label: string
  enabled: boolean
  merchantNumber: string
  merchantName: string | null
  qrImageUrl: string | null
  instructions: string | null
}

export interface PaymentConfigResponse {
  gateways: PaymentGatewayOption[]
  defaultGateway: PaymentGateway
  allowUserChoice: boolean
  manualMethods: ManualPaymentMethodConfig[]
}

export interface AdminPaymentGatewaySetting {
  id: PaymentGateway
  label: string
  currency: "BDT"
  configured: boolean
  enabled: boolean
}

export interface AdminPaymentSettings {
  gateways: AdminPaymentGatewaySetting[]
  defaultGateway: PaymentGateway
  allowUserChoice: boolean
  manualMethods: ManualPaymentMethodConfig[]
}

export interface UpdatePaymentSettingsRequest {
  enabledGateways: PaymentGateway[]
  defaultGateway: PaymentGateway
  allowUserChoice: boolean
}

export interface UpdateManualPaymentMethodRequest {
  enabled: boolean
  merchantNumber: string
  merchantName?: string
  qrImageUrl?: string
  instructions?: string
}

export interface CreatePaymentSessionRequest {
  courseId: string
  gateway?: PaymentGateway
  currency?: "BDT"
}

export interface PaymentSessionResponse {
  sessionId: string
  gateway: PaymentGateway
  checkoutUrl: string
  paymentId?: string
  manual?: boolean
}

export interface ManualPaymentDetails {
  id: string
  referenceCode: string
  amount: number
  currency: string
  gateway: ManualPaymentProvider
  status: PaymentStatus
  merchantNumber: string
  merchantName: string | null
  qrImageUrl: string | null
  instructions: string | null
  expiresAt: string | null
  entityLabel: string
  senderNumber: string | null
  customerTrxId: string | null
  rejectReason: string | null
  submittedAt: string | null
  proofUrl: string | null
}

export interface SubmitManualPaymentProofRequest {
  senderNumber: string
  customerTrxId: string
  proofUrl?: string
}

export interface AdminReviewPaymentRequest {
  reason?: string
}

export interface AdminPendingPaymentItem extends AdminPaymentItem {
  referenceCode: string | null
  senderNumber: string | null
  customerTrxId: string | null
  proofUrl: string | null
  submittedAt: string | null
  rejectReason: string | null
}

export type InstallmentAgreementStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED"
export type InstallmentPaymentStatus =
  | "PENDING"
  | "AWAITING_VERIFICATION"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED"

export interface InstallmentPlanItem {
  id: string
  courseId: string
  courseTitle: string
  label: string
  totalAmount: number
  installmentCount: number
  intervalDays: number
  downPaymentPercent: number
  isActive: boolean
}

export interface InstallmentPaymentItem {
  id: string
  installmentNo: number
  amount: number
  dueDate: string
  status: InstallmentPaymentStatus
  paidAt: string | null
  paymentId: string | null
}

export interface InstallmentAgreementItem {
  id: string
  courseId: string
  courseTitle: string
  planLabel: string
  totalAmount: number
  paidAmount: number
  status: InstallmentAgreementStatus
  nextDueDate: string | null
  accessSuspendedAt: string | null
  installments: InstallmentPaymentItem[]
}

export interface CreateInstallmentAgreementRequest {
  courseId: string
  planId: string
  gateway?: PaymentGateway
}

export interface AdminInstallmentPlanInput {
  courseId: string
  label: string
  totalAmount: number
  installmentCount: number
  intervalDays?: number
  downPaymentPercent?: number
  isActive?: boolean
}

export interface CreateGenericPaymentRequest {
  type: "digital_product" | "subscription" | "mentor_booking" | "physical_order"
  gateway?: PaymentGateway
  productId?: string
  plan?: Exclude<PlanType, "FREE">
  /** After subscription payment, auto-register for this live session */
  sessionId?: string
  slotId?: string
  /** Consultation category when booking via /consultation */
  consultationType?: ConsultationType
  items?: { productId: string; quantity: number }[]
  shippingAddress?: {
    name: string
    phone: string
    address: string
    city: string
    postalCode?: string
  }
}

// ─── Certificates ────────────────────────────────────────────────────

export interface CertificateItem {
  id: string
  certCode: string
  courseTitle: string
  pdfUrl: string
  issuedAt: string
  isRevoked: boolean
}

export interface CertificateVerification {
  valid: boolean
  certCode: string
  studentName: string
  studentId: string
  courseTitle: string
  issuedAt: string
  isRevoked: boolean
  revokedAt?: string | null
  revokedReason?: string | null
}

export interface AdminCertificateItem {
  id: string
  certCode: string
  studentName: string
  studentId: string
  courseId: string
  courseTitle: string
  issuedAt: string
  isRevoked: boolean
  revokedAt: string | null
  revokedReason: string | null
  pdfUrl: string | null
}

export interface AdminCertificateStats {
  total: number
  active: number
  revoked: number
  failed: number
}

export interface AdminCertificateListResult {
  items: AdminCertificateItem[]
  total: number
  page: number
  pageSize: number
  stats: AdminCertificateStats
}

export interface AdminCertificateFailedItem {
  enrollmentId: string
  studentId: string
  studentName: string
  uniqueStudentId: string
  courseId: string
  courseTitle: string
  progress: number
  certificateError: string | null
  completedAt: string | null
}

// ─── Notifications ───────────────────────────────────────────────────

export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationSocketPayload {
  notification?: NotificationItem
  unreadCount: number
  deletedId?: string
}

export interface LearningGoals {
  currentStreak: number
  longestStreak: number
  weeklyGoalHours: number
  weeklyProgressHours: number
  weeklyActivity: Array<{
    date: string
    active: boolean
    minutes: number
  }>
}

// ─── Course Filters ──────────────────────────────────────────────────

export interface CourseFilters {
  level?: CourseLevel
  language?: string
  minPrice?: number
  maxPrice?: number
  featured?: boolean
  free?: boolean
  sort?: "newest" | "popular" | "price_asc" | "price_desc"
  page?: number
  limit?: number
}

// ─── Platform Stats ──────────────────────────────────────────────────

export interface PlatformStats {
  students: number
  courses: number
  enrollments: number
  certificates: number
  mentors: number
}

// ─── Admin ───────────────────────────────────────────────────────────

export interface AdminStats {
  totalStudents: number
  totalCourses: number
  publishedCourses: number
  totalEnrollments: number
  totalCertificates: number
  revenueToday: number
  revenueMonth: number
  upcomingLiveSessions: number
  communityReportedPosts: number
}

export interface AdminUserItem {
  id: string
  email: string
  role: Role
  isActive: boolean
  isVerified: boolean
  createdAt: string
  studentName: string | null
  uniqueStudentId: string | null
}

export interface AdminUserEnrollment {
  id: string
  courseId: string
  courseTitle: string
  courseSlug: string
  progress: number
  enrolledAt: string
}

export interface AdminDeviceSession {
  id: string
  deviceType: string
  ipAddress: string
  lastActiveAt: string
}

export interface AdminUserDetail {
  id: string
  email: string
  role: Role
  isActive: boolean
  isVerified: boolean
  createdAt: string
  studentId: string | null
  studentName: string | null
  uniqueStudentId: string | null
  enrollments: AdminUserEnrollment[]
  deviceSessions: AdminDeviceSession[]
}

export interface AdminCourseItem {
  id: string
  title: string
  slug: string
  thumbnailUrl: string | null
  price: number
  currency: string
  status: CourseStatus
  level: CourseLevel
  language: string
  enrollmentCount: number
  isFeatured: boolean
  createdAt: string
}

export interface AdminInstructorItem {
  id: string
  displayName: string
  photoUrl: string | null
}

export interface AdminLessonItem {
  id: string
  title: string
  type: LessonType
  videoProvider: VideoProvider
  videoRef: string | null
  vimeoId: string | null
  content: string | null
  duration: number
  order: number
  isFree: boolean
}

export interface AdminSectionItem {
  id: string
  title: string
  order: number
  lessons: AdminLessonItem[]
}

export interface AdminCourseDetail {
  id: string
  title: string
  slug: string
  description: string
  subtitle: string | null
  badgeLabel: string | null
  highlights: string[]
  faqs: CourseFaqItem[]
  discountEndsAt: string | null
  seatLimit: number | null
  startsAt: string | null
  classSchedule: string | null
  deliveryType: string | null
  refundDays: number | null
  learningOutcomes: string[]
  thumbnailUrl: string | null
  price: number
  originalPrice: number | null
  currency: string
  level: CourseLevel
  language: string
  instructorId: string
  instructorName: string
  status: CourseStatus
  isFeatured: boolean
  totalDuration: number
  enrollmentCount: number
  publishedAt: string | null
  createdAt: string
  sections: AdminSectionItem[]
}

export interface AdminCourseStudent {
  enrollmentId: string
  studentId: string | null
  studentUserId: string
  studentName: string
  enrolledAt: string
  progress: number
  completedAt: string | null
}

export interface AdminCourseStudentsResponse {
  students: AdminCourseStudent[]
  total: number
  page: number
  limit: number
}

export interface CreateCourseRequest {
  title: string
  slug: string
  description: string
  subtitle?: string
  badgeLabel?: string
  highlights?: string[]
  faqs?: CourseFaqItem[]
  discountEndsAt?: string
  seatLimit?: number
  startsAt?: string
  classSchedule?: string
  deliveryType?: string
  refundDays?: number
  learningOutcomes?: string[]
  thumbnailUrl?: string
  price: number
  originalPrice?: number
  currency?: string
  level: CourseLevel
  language: string
  instructorId: string
}

export interface UploadResult {
  url: string
  path: string
}

export interface CourseVideoUploadResult {
  videoProvider: VideoProvider
  videoRef: string
  duration?: number
}

// ─── Subscription ────────────────────────────────────────────────────

export type PlanType = "FREE" | "BASIC" | "PRO" | "LIFETIME"

export interface SubscriptionInfo {
  plan: PlanType
  status: string
  startedAt: string
  expiresAt: string | null
  graceEndsAt?: string | null
  cancelAtPeriodEnd?: boolean
  cancelledAt?: string | null
  daysUntilExpiry?: number | null
  isActive?: boolean
  canCancel?: boolean
  canRenew?: boolean
  hasPremiumAccess?: boolean
}

export interface PlanOption {
  plan: PlanType
  price: number
  currency: string
  features: string[]
}

// ─── Digital Products ────────────────────────────────────────────────

export type DigitalProductType =
  | "PDF"
  | "EBOOK"
  | "TRADING_JOURNAL"
  | "TEMPLATE"
  | "INDICATOR"
  | "TOOL"
  | "BUNDLE"

export interface DigitalProductItem {
  id: string
  title: string
  slug: string
  description: string | null
  type: DigitalProductType
  thumbnailUrl: string | null
  price: number
  currency: string
  fileSize: number
  isPurchased: boolean
}

export interface ProductPurchaseItem {
  id: string
  productId: string
  title: string
  type: DigitalProductType
  fileSize: number
  purchasedAt: string
  downloadCount: number
  maxDownloads: number
}

export interface PhysicalProductItem {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  currency: string
  stock: number
  images: string[]
}

export interface MarketplaceProductItem {
  id: string
  slug: string
  title: string
  description: string | null
  price: number
  currency: string
  thumbnailUrl: string | null
  productType: "digital" | "physical"
  category: string
  stock?: number
  isPurchased?: boolean
}

export interface MarketplaceProductDetail extends MarketplaceProductItem {
  fileSize?: number
  images: string[]
}

export interface MarketplaceFilters {
  type?: "all" | "digital" | "physical"
  category?: string
  minPrice?: number
  maxPrice?: number
  free?: boolean
  sort?: "newest" | "price_asc" | "price_desc"
  search?: string
  cursor?: string
  limit?: number
}

export interface MarketplaceCatalog {
  products: MarketplaceProductItem[]
  total: number
  categories: string[]
  nextCursor: string | null
  hasMore: boolean
}

export interface SearchResultItem {
  id: string
  type: "course" | "blog" | "product"
  title: string
  subtitle: string | null
  description: string | null
  href: string
  thumbnailUrl: string | null
  price?: number
  currency?: string
  productType?: "digital" | "physical"
}

export interface SearchResponse {
  query: string
  courses: SearchResultItem[]
  blog: SearchResultItem[]
  products: SearchResultItem[]
  total: number
}

export interface CartItem {
  productId: string
  slug: string
  title: string
  price: number
  currency: string
  quantity: number
  stock: number
  thumbnailUrl: string | null
}

export interface SavedAddressItem {
  id: string
  label: string
  name: string
  phone: string
  address: string
  city: string
  postalCode: string | null
  isDefault: boolean
}

export interface CartCheckoutResult {
  orderCode?: string
  paymentId?: string
  sessionId?: string
  checkoutUrl?: string
  requiresPayment?: boolean
  gateway?: PaymentGateway
  manual?: boolean
  id?: string
  status?: string
  total?: number
}

export interface OrderShippingAddress {
  name: string
  phone: string
  address: string
  city: string
  district: string
  postalCode: string
}

export interface OrderItem {
  id: string
  orderCode: string
  status: string
  subtotal?: number
  shippingFee?: number
  total: number
  currency: string
  shippingAddress?: OrderShippingAddress
  trackingNumber?: string | null
  shippedAt?: string | null
  deliveredAt?: string | null
  createdAt: string
  items: { name: string; quantity: number; unitPrice: number }[]
}

// ─── Blog ────────────────────────────────────────────────────────────

export interface BlogPostListItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverUrl: string | null
  category: string
  categorySlug: string
  isPremium: boolean
  publishedAt: string | null
}

export interface BlogPostDetail extends BlogPostListItem {
  content: string | null
  metaTitle: string | null
  metaDesc: string | null
  isGated?: boolean
  requiredPlan?: "PRO" | "LIFETIME" | null
  relatedPosts?: BlogPostListItem[]
}

export interface BlogCategoryItem {
  id: string
  name: string
  slug: string
  postCount: number
}

// ─── Bookmarks ───────────────────────────────────────────────────────

export interface BookmarkItem {
  id: string
  entityType: string
  entityId: string
  createdAt: string
  title: string
  subtitle: string | null
  href: string
  thumbnailUrl: string | null
}

export interface WishlistItem {
  id: string
  entityType: string
  entityId: string
  createdAt: string
  title: string
  subtitle: string | null
  href: string
  thumbnailUrl: string | null
  price?: number
  currency?: string
}

export interface SaveStatus {
  bookmarkId: string | null
  wishlistId: string | null
  isBookmarked: boolean
  isWishlisted: boolean
}

// ─── Analytics ───────────────────────────────────────────────────────

export interface StudentAnalytics {
  totalLessonsCompleted: number
  coursesEnrolled: number
  coursesCompleted: number
  productsPurchased: number
  weeklyActivity: { date: string; hours: number }[]
  courseProgress: { courseTitle: string; progress: number }[]
  recentLessons: { type: string; entityId: string; createdAt: string }[]
}

// ─── Live Sessions & Mentors ─────────────────────────────────────────

export type SessionType =
  | "COURSE_CLASS"
  | "PUBLIC_WEBINAR"
  | "QA_SESSION"
  | "GROUP_MENTORSHIP"

export interface LiveSessionItem {
  id: string
  title: string
  description: string | null
  platform: string
  scheduledAt: string
  durationMinutes: number
  type: string
  isPublic: boolean
  requiresPremium?: boolean
  isPremiumLocked?: boolean
  courseId?: string | null
  courseSlug?: string | null
  isRegistered: boolean
  canJoin?: boolean
  joinOpensAt?: string
}

export interface LiveHubSession extends LiveSessionItem {
  phase: "upcoming" | "live" | "ended"
  status: string
  registrationCount: number
  attended?: boolean
  recordingUrl?: string | null
}

export interface LiveHubResponse {
  upcoming: LiveHubSession[]
  liveNow: LiveHubSession[]
  recordings: LiveHubSession[]
}

export interface LiveSessionPreview {
  id: string
  title: string
  description: string | null
  scheduledAt: string
  durationMinutes: number
  type: string
  requiresPremium: boolean
  isPremiumLocked: boolean
  courseId: string | null
  courseSlug: string | null
  isRegistered: boolean
  phase: "upcoming" | "live" | "ended"
}

export interface SessionJoinResponse {
  joinUrl: string
  platform: string
  scheduledAt: string
}

export interface AdminMentorCandidate {
  id: string
  email: string
  role: string
  displayName: string
}

export interface AdminMentorItem {
  id: string
  userId: string
  displayName: string
  bio: string | null
  photoUrl: string | null
  headline: string | null
  vision: string | null
  certifications: string[]
  experience: MentorExperienceItem[]
  specializations: string[]
  sessionDurationMinutes: number
  pricePerSession: number
  currency: string
  isAvailable: boolean
  isFeatured: boolean
  averageRating: number
  totalSessions: number
  slotCount: number
  bookingCount: number
  createdAt: string
}

export interface AdminMentorDetail extends Omit<AdminMentorItem, "slotCount"> {
  bookingCount: number
  slots: MentorSlotItem[]
}

export interface AdminMentorBookingItem {
  id: string
  studentName: string
  scheduledAt: string
  status: string
  consultationType: ConsultationType | null
  consultationTypeLabel: string | null
  sessionNotes: string | null
  rating: number | null
}

export interface AdminLiveSessionItem {
  id: string
  title: string
  description: string | null
  platform: string
  meetingUrl: string | null
  scheduledAt: string
  durationMinutes: number
  capacity: number
  type: SessionType | string
  courseId: string | null
  isPublic: boolean
  requiresPremium: boolean
  status: string
  registrationCount: number
  createdAt: string
}

export interface AdminLiveSessionDetail extends AdminLiveSessionItem {
  courseTitle: string | null
  recordingUrl: string | null
  meetingExternalId?: string | null
  attendedCount?: number
  meetingProvisionWarning?: string | null
  meetingProvisionError?: string | null
}

export interface AdminLiveSessionRegistrationsResult extends PaginatedResult<AdminLiveSessionRegistration> {
  attendedCount: number
}

export interface AdminLiveSessionRegistration {
  id: string
  studentId: string
  studentName: string
  email: string
  uniqueStudentId: string | null
  registeredAt: string
  attended: boolean
  attendedAt: string | null
}

export interface AdminLiveSessionRegistrationCandidate {
  studentId: string
  studentName: string
  email: string
  uniqueStudentId: string | null
}

export interface MentorExperienceItem {
  year: string
  role: string
}

export interface MentorItem {
  id: string
  displayName: string
  bio: string | null
  photoUrl: string | null
  headline?: string | null
  vision?: string | null
  certifications?: string[]
  experience?: MentorExperienceItem[]
  specializations: string[]
  sessionDurationMinutes: number
  pricePerSession: number
  currency: string
  averageRating: number
  totalSessions: number
  isFeatured?: boolean
}

export type TestimonialType = "VIDEO" | "SCREENSHOT" | "TRUSTPILOT" | "TEXT"

export interface TestimonialItem {
  id: string
  type: TestimonialType
  title: string | null
  content: string | null
  mediaUrl: string | null
  authorName: string
  authorPhoto: string | null
  rating: number | null
  courseName: string | null
  sortOrder: number
  isPublished: boolean
  createdAt: string
}

export interface MentorSlotItem {
  id: string
  mentorId: string
  date: string
  isBooked: boolean
}

export interface MentorBookingItem {
  id: string
  mentorId: string
  mentorName: string
  scheduledAt: string
  status: string
  consultationType: ConsultationType | null
  consultationTypeLabel: string | null
  zoomUrl: string | null
  canJoin?: boolean
  joinOpensAt?: string
  rating: number | null
  review: string | null
  sessionNotes?: string | null
  canReview?: boolean
  canCancel?: boolean
  canReschedule?: boolean
  cancelPolicyHours?: number
  mentorAverageRating?: number
  createdAt: string
}

export interface SubmitMentorReviewRequest {
  rating: number
  review?: string
}

export type CommunityReactionType = "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY"

export interface CommunityReactionSummary {
  LIKE: number
  LOVE: number
  HAHA: number
  WOW: number
  SAD: number
  ANGRY: number
  total: number
}

export interface CommunityPreviewComment {
  id: string
  authorName: string
  content: string
  createdAt: string
}

export interface CommunityPostItem {
  id: string
  title: string | null
  content: string
  likes: number
  authorName: string
  authorId: string
  parentId: string | null
  threadRootId?: string | null
  isPinned: boolean
  isOfficial?: boolean
  replyCount: number
  reactions: CommunityReactionSummary
  myReaction: CommunityReactionType | null
  likedByMe: boolean
  isOwner: boolean
  createdAt: string
  updatedAt: string
}

export interface CommunityCommentItem extends CommunityPostItem {
  children: CommunityCommentItem[]
}

export interface CommunityFeedPostItem extends CommunityPostItem {
  previewComments: CommunityPreviewComment[]
}

export interface CommunityReactResult {
  id: string
  likes: number
  likedByMe: boolean
  myReaction: CommunityReactionType | null
  reactions: CommunityReactionSummary
}

export interface CommunityPostDetail {
  post: CommunityPostItem
  replies: CommunityCommentItem[]
  replyCount: number
}

export interface AdminCreateCommunityPostBody {
  title: string
  content: string
  isPinned?: boolean
  isHidden?: boolean
}

export interface AdminCommunityPostItem extends CommunityPostItem {
  isHidden: boolean
  isDeleted: boolean
  reportCount: number
}

export type AdminCommunityFilter = "all" | "reported" | "hidden" | "deleted"

export interface AdminCommunityPostDetail {
  post: AdminCommunityPostItem
  replies: AdminCommunityCommentItem[]
}

export interface AdminCommunityCommentItem extends AdminCommunityPostItem {
  children: AdminCommunityCommentItem[]
}

export interface AdminCommunityReportItem {
  id: string
  postId: string
  reporterName: string
  reporterEmail: string
  reason: string | null
  createdAt: string
}

export interface AdminBlogPostItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverUrl: string | null
  status: string
  category: string
  isPremium: boolean
  publishedAt: string | null
  isScheduled?: boolean
  createdAt: string
}

export interface AdminBlogPostDetail {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  coverUrl: string | null
  categoryId: string
  category: string
  status: string
  isPremium: boolean
  metaTitle: string | null
  metaDesc: string | null
  publishedAt: string | null
  isScheduled: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminBlogCategoryItem {
  id: string
  name: string
  slug: string
  postCount: number
}

export interface AdminProductItem {
  id: string
  title?: string
  name?: string
  slug: string
  type?: DigitalProductType
  price: number
  currency: string
  stock?: number
  isActive: boolean
  createdAt: string
}

export interface AdminDigitalProductDetail {
  id: string
  title: string
  slug: string
  description: string | null
  type: DigitalProductType
  thumbnailUrl: string | null
  fileKey: string
  fileSize: number
  price: number
  currency: string
  maxDownloads: number
  isActive: boolean
  createdAt: string
}

export interface AdminPhysicalProductDetail {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  currency: string
  stock: number
  images: string[]
  weight: number | null
  isActive: boolean
  createdAt: string
}

export interface DigitalFileUploadResult {
  fileKey: string
  fileSize: number
}

export interface ProductImagesUploadResult {
  urls: string[]
}

export interface AdminOrderShippingAddress {
  name: string
  phone: string
  address: string
  city: string
  district: string
  postalCode: string
}

export interface AdminOrderItem {
  id: string
  orderCode: string
  status: string
  subtotal: number
  shippingFee: number
  total: number
  currency: string
  studentName: string
  studentEmail: string
  shippingAddress: AdminOrderShippingAddress
  notes: string | null
  trackingNumber: string | null
  shippedAt: string | null
  deliveredAt: string | null
  paymentId: string | null
  paymentStatus: string | null
  createdAt: string
  items: { name: string; quantity: number; unitPrice: number }[]
}

export interface PaymentStatusInfo {
  id: string
  status: string
  type: string
  amount: number
  currency: string
  gateway: string
  referenceCode?: string | null
  rejectReason?: string | null
  submittedAt?: string | null
  /** Live session to auto-register after subscription fulfillment */
  sessionId?: string | null
}

export interface AdminPaymentRefundInfo {
  type: string
  amount: number
  reason?: string
  refundedAt: string
}

export interface AdminPaymentItem {
  id: string
  type: string
  status: string
  amount: number
  currency: string
  gateway: string
  studentName: string
  studentEmail: string
  createdAt: string
  paymentRef: string | null
  tranId: string | null
  referenceCode: string | null
  senderNumber: string | null
  customerTrxId: string | null
  entityLabel: string
  refund: AdminPaymentRefundInfo | null
}

export interface RefundPaymentRequest {
  type: "full" | "partial"
  amount?: number
  reason?: string
}

export interface RefundPaymentResult {
  paymentId: string
  type: "full" | "partial"
  amount: number
  currency: string
  status: string
  entityLabel: string
}

export interface CreateOrderRequest {
  items: { productId: string; quantity: number }[]
  shippingAddress: {
    name: string
    phone: string
    address: string
    city: string
    postalCode?: string
  }
  paymentRef?: string
}

// ─── Instructor Panel ────────────────────────────────────────────────

export interface InstructorCourseItem {
  id: string
  title: string
  slug: string
  status: CourseStatus
  level: CourseLevel
  enrollmentCount: number
  createdAt: string
}

export interface InstructorCourseStudent {
  enrollmentId: string
  studentName: string
  studentId: string | null
  enrolledAt: string
  progress: number
  completedAt: string | null
}

export interface InstructorCourseDetail extends InstructorCourseItem {
  averageRating: number
  reviewCount: number
  avgProgress: number
  completedCount: number
}

export interface InstructorCourseStudentsResponse {
  students: InstructorCourseStudent[]
  total: number
  page: number
  limit: number
}

export interface InstructorStats {
  courseCount: number
  enrollmentCount: number
  publishedCount: number
  avgCompletionRate: number
  activeLearners: number
  averageRating: number
}

export interface InstructorProfile {
  id: string
  email: string
  displayName: string
  title: string | null
  bio: string | null
  photoUrl: string | null
}

export interface InstructorRecentEnrollment {
  enrollmentId: string
  courseTitle: string
  courseSlug: string
  studentName: string
  enrolledAt: string
  progress: number
}

export interface InstructorAnalyticsCourseItem {
  id: string
  title: string
  slug: string
  status: CourseStatus
  enrollmentCount: number
  averageRating: number
  reviewCount: number
  avgProgress: number
}

export interface InstructorAnalytics extends InstructorStats {
  courses: InstructorAnalyticsCourseItem[]
  recentEnrollments: InstructorRecentEnrollment[]
}

// ─── Mentor Panel ────────────────────────────────────────────────────

export interface MentorPanelProfile {
  id: string
  email: string
  displayName: string
  bio: string | null
  photoUrl: string | null
  isAvailable: boolean
  totalSessions: number
  averageRating: number
  pricePerSession: number
  currency: string
  sessionDurationMinutes: number
}

export interface MentorPanelBookingItem {
  id: string
  studentName: string
  studentId: string | null
  scheduledAt: string
  status: string
  consultationType: ConsultationType | null
  consultationTypeLabel: string | null
  zoomUrl: string | null
  canJoin?: boolean
  sessionNotes: string | null
  rating: number | null
  review: string | null
  createdAt: string
}

export interface MentorPanelSlotItem {
  id: string
  date: string
  isBooked: boolean
}

export interface MentorPanelStats {
  upcomingSessions: number
  openSlots: number
  completedSessions: number
  averageRating: number
}

// ─── Contact ─────────────────────────────────────────────────────────

export type InquirySubject =
  | "GENERAL"
  | "COURSE"
  | "PAYMENT"
  | "CONSULTATION"
  | "TECHNICAL"
  | "PARTNERSHIP"

export type InquiryStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"

export interface ContactInquiryRequest {
  name: string
  email: string
  phone?: string
  subject: InquirySubject
  message: string
  website?: string
}

export interface ContactInquiryResponse {
  id: string
  message: string
}

export interface ContactInquiryItem {
  id: string
  name: string
  email: string
  phone: string | null
  subject: InquirySubject
  subjectLabel: string
  message: string
  status: InquiryStatus
  userId: string | null
  createdAt: string
  updatedAt: string
}

export * from "./schemas/admin-course"
export {
  quizQuestionTypeSchema,
  quizQuestionSchema,
  quizContentSchema,
  parseQuizContent,
} from "./schemas/quiz"
export type {
  QuizQuestionType,
  QuizQuestionStored,
  QuizContentStored,
  QuizQuestionItem,
  QuizLessonContent,
  QuizQuestionResultItem,
  QuizSubmitResult,
} from "./schemas/quiz"

export type {
  ConsultationTypeId,
  ConsultationType,
  ConsultationTypeConfig,
} from "./consultation"
export {
  CONSULTATION_TYPES,
  CONSULTATION_TYPE_LABELS,
  MENTOR_TRADING_SKILLS,
  MENTOR_CONSULTATION_SPECIALIZATIONS,
  isConsultationTypeId,
  isConsultationType,
  consultationTypeIdToEnum,
  consultationTypeToId,
  getConsultationConfigById,
  getConsultationConfigByType,
  getConsultationLabel,
  resolveConsultationTypeId,
} from "./consultation"

export type {
  OfficeAddress,
  ContactFaqItem,
  ContactPageContent,
  ConsultationPageContent,
  SiteCtaLink,
  FooterContent,
  FooterSocialLink,
  FooterSocialPlatform,
  HomepageSectionItem,
  PublicSiteSettings,
  PublicSitePage,
  PublicHomepageSection,
  PublicHomepageContent,
  PublicConsultationTypeConfig,
  AdminSitePageListItem,
  AdminSitePageDetail,
  AdminHomepageSectionDetail,
  AdminConsultationTypeDetail,
} from "./site-cms"
export {
  officeAddressSchema,
  contactFaqItemSchema,
  contactPageContentSchema,
  consultationPageContentSchema,
  updateSiteSettingsSchema,
  updateSiteFooterSchema,
  footerContentSchema,
  footerSocialLinkSchema,
  siteCtaSchema,
  homepageSectionItemSchema,
  updateSitePageSchema,
  updateHomepageSectionSchema,
  updateConsultationTypeSchema,
} from "./site-cms"
