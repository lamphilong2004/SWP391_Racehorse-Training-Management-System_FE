import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, type RadioOption } from './RadioGroup';

const options: RadioOption[] = [
  { value: 'met', label: 'Đạt mục tiêu' },
  { value: 'partially-met', label: 'Đạt một phần mục tiêu' },
  { value: 'below', label: 'Không đạt mục tiêu' },
];

describe('RadioGroup', () => {
  it('selects an option and reports its value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RadioGroup label="Kết quả đánh giá" options={options} defaultValue="met" onChange={onChange} />);

    const selected = screen.getByRole('radio', { name: 'Đạt mục tiêu' });
    const next = screen.getByRole('radio', { name: 'Đạt một phần mục tiêu' });
    expect(selected).toBeChecked();

    await user.click(next);

    expect(next).toBeChecked();
    expect(onChange).toHaveBeenCalledWith('partially-met');
  });

  it('supports native arrow-key selection within the radio group', async () => {
    const user = userEvent.setup();
    render(<RadioGroup label="Kết quả đánh giá" options={options} defaultValue="met" />);

    const first = screen.getByRole('radio', { name: 'Đạt mục tiêu' });
    const next = screen.getByRole('radio', { name: 'Đạt một phần mục tiêu' });
    await user.tab();
    expect(first).toHaveFocus();
    await user.keyboard('{ArrowRight}');

    expect(next).toBeChecked();
    expect(next).toHaveFocus();
  });

  it('announces required and validation states with the field message', () => {
    render(<RadioGroup label="Kết quả đánh giá" options={options} required error="Hãy chọn kết quả đánh giá." />);

    const group = screen.getByRole('radiogroup', { name: 'Kết quả đánh giá' });
    const radios = screen.getAllByRole('radio');
    expect(group).toHaveAttribute('aria-required', 'true');
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription('Hãy chọn kết quả đánh giá.');
    radios.forEach((radio) => {
      expect(radio).toBeRequired();
      expect(radio).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('disables every option when the group is disabled', () => {
    render(<RadioGroup label="Kết quả đánh giá" options={options} disabled />);

    screen.getAllByRole('radio').forEach((radio) => expect(radio).toBeDisabled());
  });
});
