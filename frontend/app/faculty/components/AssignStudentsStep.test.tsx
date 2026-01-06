import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AssignStudentsStep from './AssignStudentsStep';
import { Student } from '../types';

// Mock Lucide icons
jest.mock('lucide-react', () => ({
    Users: () => <div data-testid="users-icon" />,
    Check: () => <div data-testid="check-icon" />,
    Search: () => <div data-testid="search-icon" />,
}));

const mockStudents: Student[] = [
    { uid: '1', name: 'Alice', email: 'alice@example.com', roll: 'A001', semester: '1' },
    { uid: '2', name: 'Bob', email: 'bob@example.com', roll: 'B002', semester: '1' },
    { uid: '3', name: 'Charlie', email: 'charlie@example.com', roll: 'C003', semester: '2' },
];

describe('AssignStudentsStep', () => {
    it('renders correctly', () => {
        render(
            <AssignStudentsStep
                students={mockStudents}
                selectedStudents={[]}
                setSelectedStudents={jest.fn()}
                filters={{ query: '', semester: '' }}
                setFilters={jest.fn()}
            />
        );

        expect(screen.getByText('Assign to Students')).toBeInTheDocument();
        expect(screen.getByText('0 selected')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search by name or roll number...')).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('filters students based on search query', () => {
        render(
            <AssignStudentsStep
                students={mockStudents}
                selectedStudents={[]}
                setSelectedStudents={jest.fn()}
                filters={{ query: 'Alice', semester: '' }}
                setFilters={jest.fn()}
            />
        );

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });

    it('handles student selection', () => {
        const setSelectedStudents = jest.fn();
        render(
            <AssignStudentsStep
                students={mockStudents}
                selectedStudents={[]}
                setSelectedStudents={setSelectedStudents}
                filters={{ query: '', semester: '' }}
                setFilters={jest.fn()}
            />
        );

        fireEvent.click(screen.getByText('Alice'));
        // Since prev state is used, we check if the function was called
        expect(setSelectedStudents).toHaveBeenCalled();
    });

    it('handles select all', () => {
        const setSelectedStudents = jest.fn();
        render(
            <AssignStudentsStep
                students={mockStudents}
                selectedStudents={[]}
                setSelectedStudents={setSelectedStudents}
                filters={{ query: '', semester: '' }}
                setFilters={jest.fn()}
            />
        );

        fireEvent.click(screen.getByText(/Select All/i));
        expect(setSelectedStudents).toHaveBeenCalledWith(expect.any(Array)); // Should check argument content if possible, but mock checks call
    });

    it('shows selected count', () => {
        render(
            <AssignStudentsStep
                students={mockStudents}
                selectedStudents={[mockStudents[0]]}
                setSelectedStudents={jest.fn()}
                filters={{ query: '', semester: '' }}
                setFilters={jest.fn()}
            />
        );
        expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
});
