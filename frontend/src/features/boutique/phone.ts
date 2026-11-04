export const canonicalPhone = (value: string) => value.replace('-', '')
export const validPhone = (value: string) => /^[78][0-9]{7}$/.test(canonicalPhone(value))
export const formatPhone = (value: string) => value.replace(/^([0-9]{4})([0-9]{1,4})$/, '$1-$2')

