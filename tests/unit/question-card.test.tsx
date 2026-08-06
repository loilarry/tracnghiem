import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionCard } from "../../src/App";
import { questions } from "../../src/data/questions";

const question = questions[0];

describe("QuestionCard", () => {
  it("keeps submit disabled until a radio option is selected", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<QuestionCard question={question} feedback={null} selected="" onSelect={onSelect} onSubmit={vi.fn()} onNext={vi.fn()} disabled={false} />);
    const submit = screen.getByRole("button", { name: /Trả lời/ });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getAllByRole("radio")[0]);
    expect(onSelect).toHaveBeenCalledWith("A");
    rerender(<QuestionCard question={question} feedback={null} selected="A" onSelect={onSelect} onSubmit={vi.fn()} onNext={vi.fn()} disabled={false} />);
    expect(screen.getByRole("button", { name: /Trả lời/ })).toBeEnabled();
  });

  it("renders textual feedback and locks options after an answer", () => {
    render(<QuestionCard question={question} feedback={{ selectedOptionId: "B", correct: false }} selected="B" onSelect={vi.fn()} onSubmit={vi.fn()} onNext={vi.fn()} disabled={false} />);
    expect(screen.getByText("Chưa đúng lần này")).toBeVisible();
    expect(screen.getByText((_, element) => element?.textContent === "Đáp án đúng: A")).toBeVisible();
    expect(screen.getByRole("group", { name: "Chọn một đáp án" })).toHaveAttribute("disabled");
  });
});
