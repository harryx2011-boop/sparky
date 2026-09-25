import type { OpDescriptor } from '@sparky/engine'
import { describe, expect, it } from 'vitest'
import { resolveSecrets, type SecretIo } from '../src/secrets'

const op: Pick<OpDescriptor, 'secret'> = { secret: ['userPassword', 'ownerPassword'] }

function io(over: Partial<SecretIo> = {}): SecretIo & { prompts: string[] } {
  const prompts: string[] = []
  return {
    env: {},
    interactive: false,
    readStdin: async () => {
      throw new Error('stdin not expected')
    },
    prompt: async (label) => {
      prompts.push(label)
      return ''
    },
    prompts,
    ...over,
  }
}

describe('secret fields on the command line', () => {
  it('refuses a literal value and names the three ways', async () => {
    await expect(resolveSecrets(op, { files: ['a'], userPassword: 'hunter2' }, io())).rejects.toThrow(
      /--user-password can't take the value on the command line.*"--user-password -".*SPARKY_USER_PASSWORD.*asked/,
    )
  })

  it('reads "-" from stdin, dropping the trailing newline', async () => {
    const r = await resolveSecrets(op, { userPassword: '-' }, io({ readStdin: async () => 's3cret\r\n' }))
    expect(r.userPassword).toBe('s3cret')
  })

  it('refuses two fields reading stdin', async () => {
    await expect(resolveSecrets(op, { userPassword: '-', ownerPassword: '-' }, io({ readStdin: async () => 'x' }))).rejects.toThrow(/Only one option/)
  })

  it('takes SPARKY_<FIELD> from the environment', async () => {
    const r = await resolveSecrets(op, {}, io({ env: { SPARKY_OWNER_PASSWORD: 'from-env' } }))
    expect(r).toEqual({ ownerPassword: 'from-env' })
  })

  it('asks on a terminal with hidden input, and an empty answer leaves the field out', async () => {
    const answers = ['typed', '']
    const t = io({ interactive: true, prompt: async () => answers.shift()! })
    const r = await resolveSecrets(op, { files: ['a'] }, t)
    expect(r).toEqual({ files: ['a'], userPassword: 'typed' })
  })

  it('asks nothing when not on a terminal', async () => {
    const t = io()
    expect(await resolveSecrets(op, { files: ['a'] }, t)).toEqual({ files: ['a'] })
    expect(t.prompts).toEqual([])
  })
})
