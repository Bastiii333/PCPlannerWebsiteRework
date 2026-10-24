import type { StylesConfig } from 'react-select'
import type { PartOption } from '../types/parts'

export const selectStyles: StylesConfig<PartOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: '48px',
    borderRadius: '12px',
    borderColor: state.isFocused ? '#8b5cf6' : '#dbe3f0',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(139, 92, 246, 0.14)' : 'none',
    '&:hover': { borderColor: '#a78bfa' },
  }),
  valueContainer: (base) => ({ ...base, padding: '8px 16px' }),
  placeholder: (base) => ({ ...base, color: '#94a3b8' }),
  menu: (base) => ({
    ...base,
    overflow: 'hidden',
    borderRadius: '12px',
    boxShadow: '0 16px 36px rgba(30, 41, 59, 0.14)',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 50 }),
  option: (base, state) => ({
    ...base,
    padding: '12px 16px',
    backgroundColor: state.isFocused ? '#f5f3ff' : 'white',
    color: '#1e293b',
    cursor: 'pointer',
  }),
}
