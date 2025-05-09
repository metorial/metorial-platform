import {
  addMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

let dateToRange = (date: Date | [Date, Date]): [Date, Date] => {
  if (Array.isArray(date)) return date;
  return [date, date];
};

export type DatePickerProps =
  | {
      value: Date | undefined;
      onChange: (date: Date) => void;
      type: 'single';
    }
  | {
      value: [Date, Date] | undefined;
      onChange: (date: [Date, Date]) => void;
      type: 'range';
    };

export let useDatePickerState = ({
  value,
  onChange,
  type,
  open,
  maxDate,
  minDate
}: {
  open?: boolean;
  maxDate?: Date;
  minDate?: Date;
} & DatePickerProps) => {
  let [selectedDate, setSelectedDate] = useState(() =>
    value ? dateToRange(value) : undefined
  );
  // let dateReferenceAnchor = useMemo(() => {
  //   if (!selectedDate) return startOfMonth(new Date());
  //   return startOfMonth(selectedDate[0]);
  // }, [selectedDate]);

  useEffect(() => {
    setSelectedDate(value ? dateToRange(value) : undefined);
  }, [value, open]);

  let [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(selectedDate ? selectedDate[0] : new Date())
  );
  useEffect(() => {
    let start = startOfWeek(startOfMonth(selectedDate ? selectedDate[0] : new Date()));
    let end = endOfWeek(endOfMonth(selectedDate ? selectedDate[1] : new Date()));

    if (!isWithinInterval(currentMonth, { start, end })) {
      setCurrentMonth(startOfMonth(selectedDate ? selectedDate[0] : new Date()));
    }
  }, [selectedDate]);

  let prevMonthEnabled = !minDate || isAfter(currentMonth, minDate);
  let nextMonthEnabled = !maxDate || isBefore(addMonths(currentMonth, 1), maxDate);

  let nextMonth = () => setCurrentMonth(startOfMonth(addMonths(currentMonth, 1)));
  let prevMonth = () => setCurrentMonth(startOfMonth(subMonths(currentMonth, 1)));

  let days = useMemo(() => {
    let startDate = currentMonth;
    let endDate = endOfMonth(currentMonth);

    let weeks = eachWeekOfInterval({ start: startDate, end: endDate });

    return weeks.map(week => {
      return {
        id: `week_${week.getTime()}`,
        days: eachDayOfInterval({
          start: startOfWeek(week),
          end: endOfWeek(week)
        }).map(day => {
          let isInSelectedRange = !!(
            selectedDate &&
            isWithinInterval(day, { start: selectedDate[0], end: selectedDate[1] })
          );
          let isStartOfRange = !!selectedDate && isSameDay(day, selectedDate[0]);
          let isEndOfRange = !!selectedDate && isSameDay(day, selectedDate[1]);

          return {
            id: `day_${day.getTime()}`,

            date: day,
            isToday: isToday(day),

            isInSelectedRange,
            isSelected: isStartOfRange || isEndOfRange,
            isStartOfRange,
            isEndOfRange,

            isCurrentMonth: isSameMonth(day, currentMonth)
          };
        })
      };
    });
  }, [currentMonth, selectedDate]);

  let selectDate = (date: Date | [Date, Date]) => {
    if (type == 'single') {
      let range = dateToRange(date);
      setSelectedDate(range);
      onChange(range[0]);
    } else {
      let range: [Date, Date];

      if (Array.isArray(date)) {
        range = date;
      } else {
        if (
          !selectedDate ||
          isSameDay(date, selectedDate[0]) ||
          isSameDay(date, selectedDate[1])
        ) {
          range = [date, date];
        } else if (isBefore(date, selectedDate[0])) {
          range = [date, selectedDate[1]];
        } else if (isAfter(date, selectedDate[1])) {
          range = [selectedDate[0], date];
        } else {
          range = [selectedDate[0], date];
        }
      }

      let normalizedRange = [startOfDay(range[0]), endOfDay(range[1])] as [Date, Date];

      setSelectedDate(normalizedRange);
      onChange(normalizedRange);
    }
  };

  let stringValue = useMemo(() => {
    if (!selectedDate) return undefined;

    if (type == 'single') {
      return selectedDate[0].toLocaleDateString();
    } else {
      return selectedDate.map(d => d.toLocaleDateString()).join(' - ');
    }
  }, [selectedDate, type]);

  let reset = () => {
    setSelectedDate(undefined);
    onChange(undefined as any);
  };

  return {
    currentMonth,
    nextMonth,
    prevMonth,
    days,
    selectDate,
    stringValue,
    reset,
    nextMonthEnabled,
    prevMonthEnabled
  };
};
