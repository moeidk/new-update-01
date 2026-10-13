import React, { useState, useEffect } from 'react';
import { formatNumberInputLive, parseFormattedNumber } from '../utils/formatters';

interface FormattedNumberInputProps {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  unitLabel?: string;
  id?: string;
  name?: string;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  min,
  max,
  required = false,
  className = '',
  disabled = false,
  unitLabel,
  id,
  name,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    return value ? formatNumberInputLive(String(value)) : '';
  });

  useEffect(() => {
    // Sync external changes
    const currentNum = parseFormattedNumber(displayValue);
    if (value !== currentNum) {
      setDisplayValue(value ? formatNumberInputLive(String(value)) : '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatNumberInputLive(raw);
    setDisplayValue(formatted);

    let numeric = parseFormattedNumber(formatted);
    if (min !== undefined && numeric < min && raw !== '') {
      // allow typing lower values while editing, don't clamp prematurely
    }
    if (max !== undefined && numeric > max) {
      numeric = max;
      setDisplayValue(formatNumberInputLive(String(max)));
    }

    onChange(numeric);
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        type="text"
        inputMode="numeric"
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        dir="ltr"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full text-left font-mono tracking-wider tabular-nums ${className}`}
        // Reserve room on the left for the unit label so digits never run under it
        style={unitLabel ? { paddingLeft: `${unitLabel.length * 0.55 + 1.75}rem` } : undefined}
      />
      {unitLabel && (
        <span className="absolute left-3 text-[11px] font-sans text-[#94A2C2] pointer-events-none select-none">
          {unitLabel}
        </span>
      )}
    </div>
  );
};
