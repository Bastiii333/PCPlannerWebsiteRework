import Select from 'react-select'
import { Rnd } from 'react-rnd'
import type { PartOption } from '../types/parts'
import { selectStyles } from './selectorStyles'

type PartSelectorProps = {
  windowId: string
  selectionId: string
  inputId: string
  title: string
  icon: string
  options: PartOption[]
  value: PartOption | null
  onChange: (option: PartOption | null) => void
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  error: string | null
  defaultPosition?: { x: number; y: number }
}

function PartSelector({
  windowId, selectionId, inputId, title, icon, options, value, onChange,
  isLoading, isLoadingMore, hasMore, onLoadMore, error, defaultPosition,
}: PartSelectorProps) {
  return (
    <Rnd
      id={windowId}
      data-component="PartSelectorWindow"
      bounds="parent"
      default={{
        x: defaultPosition?.x ?? 16,
        y: defaultPosition?.y ?? 16,
        width: 'min(520px, calc(100vw - 32px))',
        height: 360,
      }}
      enableResizing={false}
      dragHandleClassName="part-selector-drag-handle"
      data-element="selector-window"
      className="part-selector-window"
    >
      <div id={selectionId} data-component="PartSelectionSection" data-element="selector-card" className="selector-card">
        <div id={`${selectionId}-title-bar`} data-element="window-title-bar" className="part-selector-drag-handle selector-title-bar">
          <div data-element="section-icon" className="selector-icon">{icon}</div>
          <div data-element="section-heading">
            <p data-element="section-label" className="selector-kicker">Choose a part</p>
            <h2 data-element="section-title" className="selector-title">{title}</h2>
          </div>
        </div>
        <div id={`${selectionId}-content`} data-element="selector-content" className="selector-content">
          <Select<PartOption, false>
            data-element="part-select-control"
            inputId={inputId}
            aria-label={title}
            options={options}
            value={value}
            onChange={onChange}
            placeholder={isLoading ? 'Loading parts...' : `Search and select ${title.toLowerCase()}...`}
            isLoading={isLoading || isLoadingMore}
            isDisabled={(isLoading && options.length === 0) || (Boolean(error) && options.length === 0)}
            isClearable
            menuPortalTarget={document.body}
            menuPosition="fixed"
            onMenuScrollToBottom={onLoadMore}
            noOptionsMessage={() =>
              error && options.length === 0
                ? 'Unable to load parts'
                : hasMore ? 'Scroll to load more parts' : 'No matching parts found'
            }
            formatOptionLabel={(option) => (
              <div data-element="part-option" className="selector-option">
                <div>
                  <p data-element="option-label" className="selector-option-label">{option.label}</p>
                  <p data-element="option-details" className="selector-option-details">{option.details}</p>
                </div>
                <div data-element="option-meta" className="selector-option-meta">
                  {option.badge && <span data-element="option-badge" className="selector-option-badge">{option.badge}</span>}
                  <span data-element="option-price" className="selector-option-price">{option.price}</span>
                </div>
              </div>
            )}
            styles={selectStyles}
          />
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}. Make sure your backend is running.</p>}
        </div>
      </div>
    </Rnd>
  )
}

export default PartSelector
