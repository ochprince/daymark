/*
 * 两只（卡片里 / 卡片外）共用的物理常数。
 * 单独放在这里是为了让卡片那套模拟能被 node 直接测：
 * 从 PetLayer 里拿的话会把 pets.css 也拖进来，node 加载不了。
 */

/** 重力，px/s² */
export const PET_GRAVITY = 2200
