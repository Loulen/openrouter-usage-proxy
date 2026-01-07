import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import type { FiltersProps, FilterParams } from '../types';

/**
 * Truncate a model name for display in the dropdown
 * Shows full name on hover via title attribute
 * @param model - The model identifier
 * @param maxLength - Maximum characters to display
 * @returns Truncated model name
 */
function truncateModelName(model: string, maxLength: number = 40): string {
  if (model.length <= maxLength) {
    return model;
  }
  return `${model.substring(0, maxLength - 3)}...`;
}

/**
 * Parse a date string to Date object for DatePicker
 * @param dateString - ISO 8601 date string or undefined
 * @returns Date object or null
 */
function parseDate(dateString: string | undefined): Date | null {
  if (!dateString) {
    return null;
  }
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format a Date object to ISO 8601 date string (YYYY-MM-DD)
 * @param date - Date object or null
 * @returns ISO date string or undefined
 */
function formatDateToISO(date: Date | null): string | undefined {
  if (!date) {
    return undefined;
  }
  // Format as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Filters component for filtering logs and stats by model and date range
 * Provides a model dropdown and date range pickers with neumorphism styling
 * Handles edge cases like invalid date ranges and long model names
 */
export function Filters({
  filters,
  onFiltersChange,
  models,
  modelsLoading = false,
}: FiltersProps): JSX.Element {
  // Parse current filter dates
  const fromDate = parseDate(filters.from);
  const toDate = parseDate(filters.to);

  /**
   * Handle model selection change
   */
  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = event.target.value || undefined;
    onFiltersChange({
      ...filters,
      model: newModel,
    });
  };

  /**
   * Handle start date change
   * Auto-swaps dates if end date is before start date
   */
  const handleFromDateChange = (date: Date | null) => {
    const newFrom = formatDateToISO(date);
    const newFilters: FilterParams = {
      ...filters,
      from: newFrom,
    };

    // Auto-swap if from date is after to date
    if (newFrom && filters.to && newFrom > filters.to) {
      newFilters.from = filters.to;
      newFilters.to = newFrom;
    }

    onFiltersChange(newFilters);
  };

  /**
   * Handle end date change
   * Auto-swaps dates if end date is before start date
   */
  const handleToDateChange = (date: Date | null) => {
    const newTo = formatDateToISO(date);
    const newFilters: FilterParams = {
      ...filters,
      to: newTo,
    };

    // Auto-swap if to date is before from date
    if (newTo && filters.from && newTo < filters.from) {
      newFilters.from = newTo;
      newFilters.to = filters.from;
    }

    onFiltersChange(newFilters);
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    onFiltersChange({});
  };

  // Check if any filters are active
  const hasActiveFilters = filters.model || filters.from || filters.to;

  return (
    <div className="filters">
      <div className="filters-grid">
        {/* Model Filter */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="model-filter">
            Model
          </label>
          <select
            id="model-filter"
            className="neu-select filter-select"
            value={filters.model || ''}
            onChange={handleModelChange}
            disabled={modelsLoading}
          >
            <option value="">All Models</option>
            {models.map((model) => (
              <option key={model} value={model} title={model}>
                {truncateModelName(model)}
              </option>
            ))}
          </select>
        </div>

        {/* From Date Filter */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="from-date-filter">
            From Date
          </label>
          <DatePicker
            id="from-date-filter"
            className="neu-input filter-datepicker"
            selected={fromDate}
            onChange={handleFromDateChange}
            selectsStart
            startDate={fromDate}
            endDate={toDate}
            maxDate={toDate || new Date()}
            placeholderText="Select start date"
            dateFormat="yyyy-MM-dd"
            isClearable
          />
        </div>

        {/* To Date Filter */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="to-date-filter">
            To Date
          </label>
          <DatePicker
            id="to-date-filter"
            className="neu-input filter-datepicker"
            selected={toDate}
            onChange={handleToDateChange}
            selectsEnd
            startDate={fromDate}
            endDate={toDate}
            minDate={fromDate}
            maxDate={new Date()}
            placeholderText="Select end date"
            dateFormat="yyyy-MM-dd"
            isClearable
          />
        </div>

        {/* Clear Filters Button */}
        <div className="filter-group filter-actions">
          <label className="filter-label filter-label-spacer">&nbsp;</label>
          <button
            type="button"
            className="neu-button filter-clear-button"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}
