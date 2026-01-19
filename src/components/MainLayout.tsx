import React from 'react';
import { Outlet } from 'react-router-dom';

const MainLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Note: NewTaskSidebar and other global shells can be managed here if they need to persist across sub-pages 
                 or we can keep them in the Dashboard for now as they are specific to that view.
                 For this implementation, the design requests Navigation Sidebar (Left) to be reusable.
                 The current NewTaskSidebar is actually a Right Action Panel, not navigation.
                 The DashboardPreview contained the main content.
                 So MainLayout will be the wrapper for the page content.
             */}

            {/* Future Navigation Sidebar (Left) would go here */}

            <main className="flex-1 w-full">
                <Outlet />
            </main>

            {/* Right Action Panel (NewTaskSidebar) is currently inside DashboardPreview, 
                so it remains part of the Outlet content for now unless we lift it up.
                Keeping it simple as requested: "Refactor... move Header and Sidebar code... to MainLayout"
                Wait, DashboardPreview had the layout inside.
                Let's make sure MainLayout handles the full screen structure.
            */}
        </div>
    );
};

export default MainLayout;
