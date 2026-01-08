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
    {
        uid: '1', name: 'Alice', email: 'alice@example.com', roll_no: 'A001', semester: '1', batch: '2024',
        role: 'student', profile_pic: null, created_at: '', updated_at: '', active_session_id: null, session_updated_at: null, department: null
    },
    {
        uid: '2', name: 'Bob', email: 'bob@example.com', roll_no: 'B002', semester: '1', batch: '2024',
        role: 'student', profile_pic: null, created_at: '', updated_at: '', active_session_id: null, session_updated_at: null, department: null
    },
    {
        uid: '3', name: 'Charlie', email: 'charlie@example.com', roll_no: 'C003', semester: '2', batch: '2025',
        role: 'student', profile_pic: null, created_at: '', updated_at: '', active_session_id: null, session_updated_at: null, department: null
    },
];

describe('AssignStudentsStep', () => {
    it('renders correctly', () => {
        render(
            <AssignStudentsStep
                students={mockStudents}
                selectedStudents={[]}
                setSelectedStudents={jest.fn()}
                filters={{ query: '', semester: '', batch: '' }}
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
                filters={{ query: 'Alice', semester: '', batch: '' }}
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
                filters={{ query: '', semester: '', batch: '' }}
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
                filters={{ query: '', semester: '', batch: '' }}
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
                filters={{ query: '', semester: '', batch: '' }}
                setFilters={jest.fn()}
            />
        );
        expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
});
