/* eslint-disable @next/next/no-img-element */

import React, { useContext } from 'react';
import { LayoutContext } from './context/layoutcontext';

const AppFooter = () => {
    const { layoutConfig } = useContext(LayoutContext);

    return (
        <div className="layout-footer">
            {/* Mismo logo de "Sistema TSA" que se usa en el topbar y en el login. */}
            <img src="/demo/images/blocks/logos/hyper.svg" alt="Sistema TSA" height="20" className="mr-2" />
            by
            <span className="font-medium ml-2">Dashboard</span>
        </div>
    );
};

export default AppFooter;
