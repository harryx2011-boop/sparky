// pdf ops. Adding one = one module in ../pdf/ops + one line here (+ its words in core's PDF_TEXT).
import { compressOp } from '../pdf/ops/compress'
import { extractImagesOp } from '../pdf/ops/extract-images'
import { extractPagesOp } from '../pdf/ops/extract-pages'
import { flattenOp } from '../pdf/ops/flatten'
import { fromImagesOp } from '../pdf/ops/from-images'
import { mergeOp } from '../pdf/ops/merge'
import { protectOp } from '../pdf/ops/protect'
import { removePagesOp } from '../pdf/ops/remove-pages'
import { rotateOp } from '../pdf/ops/rotate'
import { splitOp } from '../pdf/ops/split'
import { toImagesOp } from '../pdf/ops/to-images'
import { unlockOp } from '../pdf/ops/unlock'
import type { Op } from './types'

export const pdfOps: readonly Op[] = [
  fromImagesOp,
  toImagesOp,
  mergeOp,
  splitOp,
  rotateOp,
  removePagesOp,
  extractPagesOp,
  extractImagesOp,
  compressOp,
  protectOp,
  unlockOp,
  flattenOp,
]
