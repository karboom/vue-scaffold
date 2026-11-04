/**
 * 用户资料类型（仅类型）
 * 与实现文件分离：mock 替身复用同一份类型，而实现文件会被 vite alias 整体替换
 */

export type ProfileItem = {
    id: string
    name: string
    email: string
    avatar: string
}
