// media ops: edit, compress, thumbnails and GIF. The work lives in ../media.
import { compressOp } from '../media/compress'
import { editOp } from '../media/edit'
import { gifOp } from '../media/gif'
import { thumbsOp } from '../media/thumbs'
import type { Op } from './types'

export const mediaOps: readonly Op[] = [editOp, compressOp, thumbsOp, gifOp]
