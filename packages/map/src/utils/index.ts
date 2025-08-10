import {Color} from '@/types'

export const delay = (duration = 1000) => new Promise(resolve => setTimeout(resolve, duration))

export const isSameColor = (c1: Color, c2: Color) => {
    return c1.every((c, i) => c2[i])
}